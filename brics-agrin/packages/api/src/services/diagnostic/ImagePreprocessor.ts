/**
 * Image Preprocessor — Stage 2 of the diagnostic pipeline.
 *
 * Normalizes images to a consistent format before model inference:
 *   - Resize to model input dimensions (224×224 default)
 *   - Convert to RGB (strip alpha channel)
 *   - Convert to JPEG for consistent encoding
 *   - Compute SHA-256 hash of the ORIGINAL buffer for deduplication/audit
 *
 * Processing is done with sharp — no external calls.
 * The original image is never stored directly on disk.
 */

import sharp from 'sharp';
import { sha256Hex } from '../../utils/crypto.js';
import type { ProcessedImage } from '../../domain/diagnostic/types.js';
import { createLogger } from '../../observability/logger.js';

const log = createLogger('image-preprocessor');

// Standard input size for most plant disease classification models
const MODEL_INPUT_SIZE = 224;

export class ImagePreprocessor {
  /**
   * Preprocess a validated image buffer for model inference.
   * Returns a ProcessedImage with the normalized buffer and metadata.
   */
  async preprocess(
    originalBuffer: Buffer,
    originalMimeType: string,
  ): Promise<ProcessedImage> {
    // Hash the ORIGINAL before any transformation — this is the content fingerprint
    const fileHash = sha256Hex(originalBuffer);

    try {
      const processedBuffer = await sharp(originalBuffer)
        .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .removeAlpha()           // Ensure 3-channel RGB input
        .jpeg({ quality: 90 })  // Consistent encoding
        .toBuffer();

      log.debug(
        {
          originalSize: originalBuffer.length,
          processedSize: processedBuffer.length,
          originalMime: originalMimeType,
        },
        'Image preprocessed',
      );

      return {
        buffer: processedBuffer,
        widthPx: MODEL_INPUT_SIZE,
        heightPx: MODEL_INPUT_SIZE,
        mimeType: 'image/jpeg',
        fileHash,
      };
    } catch (err) {
      log.error({ err }, 'Image preprocessing failed');
      throw new Error(`Image preprocessing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export const imagePreprocessor = new ImagePreprocessor();
