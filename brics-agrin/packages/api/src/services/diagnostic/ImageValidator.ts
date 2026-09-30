/**
 * Image Validator — Stage 1 of the diagnostic pipeline.
 *
 * Security rules (all must pass before processing proceeds):
 *   1. File size within configured limit
 *   2. MIME type is in the allowlist
 *   3. Magic bytes match declared MIME type (prevents extension spoofing)
 *   4. Image dimensions within configured limits
 *   5. Image is actually decodable (not a corrupt or malformed file)
 *
 * Never trusts the filename extension or the Content-Type header alone.
 * Uses sharp to probe the actual image data.
 */

import sharp from 'sharp';
import { config } from '../../config/index.js';
import type { ImageValidationResult } from '../../domain/diagnostic/types.js';
import { createLogger } from '../../observability/logger.js';

const log = createLogger('image-validator');

// ── Magic byte signatures for allowed image types ─────────────────────────────
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/webp': [], // WebP: checked by sharp decode, no simple magic byte prefix
};

export class ImageValidator {
  /**
   * Validate an image buffer.
   * Returns a result object rather than throwing so callers can
   * build descriptive error messages without catching.
   */
  async validate(
    buffer: Buffer,
    declaredMimeType: string,
  ): Promise<ImageValidationResult> {
    // ── Size check ────────────────────────────────────────────────────────────
    if (buffer.length > config.IMAGE_MAX_SIZE_BYTES) {
      return this.reject(
        declaredMimeType,
        `File size ${(buffer.length / 1024 / 1024).toFixed(1)} MB exceeds maximum of ${(config.IMAGE_MAX_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB`,
        buffer.length,
      );
    }

    // ── MIME type allowlist ───────────────────────────────────────────────────
    const normalizedMime = declaredMimeType.toLowerCase().trim();
    if (!config.IMAGE_ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      return this.reject(
        normalizedMime,
        `File type '${normalizedMime}' is not accepted. Allowed types: ${config.IMAGE_ALLOWED_MIME_TYPES.join(', ')}`,
        buffer.length,
      );
    }

    // ── Magic bytes verification (JPEG and PNG) ────────────────────────────────
    if (normalizedMime !== 'image/webp') {
      const signatures = MAGIC_BYTES[normalizedMime] ?? [];
      const matchesMagic = signatures.some((sig) =>
        buffer.subarray(0, sig.length).equals(sig),
      );
      if (signatures.length > 0 && !matchesMagic) {
        return this.reject(
          normalizedMime,
          'File content does not match its declared type. Possible file spoofing detected.',
          buffer.length,
        );
      }
    }

    // ── Sharp decode — proves file is a valid, decodable image ────────────────
    try {
      const metadata = await sharp(buffer).metadata();

      if (!metadata.width || !metadata.height) {
        return this.reject(normalizedMime, 'Could not determine image dimensions', buffer.length);
      }

      // ── Dimension check ───────────────────────────────────────────────────
      if (
        metadata.width > config.IMAGE_MAX_DIMENSION_PX ||
        metadata.height > config.IMAGE_MAX_DIMENSION_PX
      ) {
        return this.reject(
          normalizedMime,
          `Image dimensions ${metadata.width}×${metadata.height}px exceed maximum of ${config.IMAGE_MAX_DIMENSION_PX}px`,
          buffer.length,
        );
      }

      // ── Minimum dimension check (too small = useless for diagnosis) ──────
      if (metadata.width < 64 || metadata.height < 64) {
        return this.reject(
          normalizedMime,
          `Image is too small (${metadata.width}×${metadata.height}px). Minimum 64×64px required for reliable disease analysis.`,
          buffer.length,
        );
      }

      log.debug(
        { width: metadata.width, height: metadata.height, mime: normalizedMime, sizeBytes: buffer.length },
        'Image validation passed',
      );

      return {
        isValid: true,
        mimeType: normalizedMime,
        widthPx: metadata.width,
        heightPx: metadata.height,
        sizeBytes: buffer.length,
      };
    } catch (err) {
      log.warn({ err }, 'Sharp failed to decode image');
      return this.reject(
        normalizedMime,
        'Image could not be decoded. The file may be corrupt or not a valid image.',
        buffer.length,
      );
    }
  }

  private reject(
    mimeType: string,
    reason: string,
    sizeBytes: number,
  ): ImageValidationResult {
    return {
      isValid: false,
      mimeType,
      widthPx: 0,
      heightPx: 0,
      sizeBytes,
      rejectionReason: reason,
    };
  }
}

export const imageValidator = new ImageValidator();
