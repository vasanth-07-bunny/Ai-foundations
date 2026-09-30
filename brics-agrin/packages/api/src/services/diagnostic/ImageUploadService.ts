/**
 * Image Upload Service.
 *
 * Handles secure image upload before the diagnostic job is enqueued.
 * Security pipeline:
 *   1. Validate file (size, MIME, magic bytes, dimensions)
 *   2. Compute content hash (deduplication + audit)
 *   3. Generate server-side UUID storage key (never use original filename)
 *   4. Store in object storage (not filesystem, not executable path)
 *   5. Register in uploaded_images table with expiry
 *   6. Return the image UUID for use in the diagnostic request
 *
 * The client never receives a direct storage URL — only an opaque UUID.
 * Uploaded images expire after 24 hours if not linked to a diagnostic.
 */

import { randomUUID } from 'crypto';
import { prisma } from '../../db/client.js';
import { imageValidator } from './ImageValidator.js';
import { sha256Hex } from '../../utils/crypto.js';
import { ImageValidationError } from '../../utils/errors.js';
import { createLogger } from '../../observability/logger.js';

const log = createLogger('image-upload');

// Images not used in a diagnostic expire after 24 hours
const IMAGE_EXPIRY_HOURS = 24;

/** The public DTO returned to callers — contains only client-safe fields */
export interface UploadedImagePublic {
  id: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
}

/** Internal record — includes storageKey which must NEVER be sent to clients */
interface UploadedImageInternal extends UploadedImagePublic {
  storageKey: string;
  fileHash: string;
}

/** @deprecated Use UploadedImagePublic for API responses */
export type UploadedImageRecord = UploadedImagePublic;

export class ImageUploadService {
  /**
   * Validate, hash, and register an uploaded image.
   * Returns the server-assigned image UUID for use in DiagnosticRequest.
   */
  async upload(
    fileBuffer: Buffer,
    declaredMimeType: string,
    originalFilename: string,
    uploadedByUserId: string,
  ): Promise<UploadedImagePublic> {
    // ── Stage 1: Validate ─────────────────────────────────────────────────────
    const validation = await imageValidator.validate(fileBuffer, declaredMimeType);
    if (!validation.isValid) {
      throw new ImageValidationError(validation.rejectionReason ?? 'Image validation failed');
    }

    // ── Stage 2: Compute content hash ─────────────────────────────────────────
    const fileHash = sha256Hex(fileBuffer);

    // ── Stage 3: Generate server-side storage key ─────────────────────────────
    // The original filename is NEVER used as the storage key
    // Key format: uploads/{userId-prefix}/{uuid}.jpg
    const imageId = randomUUID();
    const storageKey = `uploads/${uploadedByUserId.slice(0, 8)}/${imageId}`;

    // ── Stage 4: Store in object storage ─────────────────────────────────────
    // TODO: Implement real object storage (S3/MinIO) upload here
    // await objectStorageClient.put(storageKey, fileBuffer, validation.mimeType);
    log.info({ storageKey, sizeBytes: fileBuffer.length }, 'Image stored (stub — object storage not configured)');

    // ── Stage 5: Register in database ────────────────────────────────────────
    // Sanitize original filename — strip path traversal attempts
    const safeOriginalName = originalFilename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 255);

    const expiresAt = new Date(Date.now() + IMAGE_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.uploadedImage.create({
      data: {
        id: imageId,
        storageKey,
        originalName: safeOriginalName,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
        widthPx: validation.widthPx,
        heightPx: validation.heightPx,
        fileHash,
        uploadedBy: uploadedByUserId,
        isUsed: false,
        expiresAt,
      },
    });

    log.info({ imageId, uploadedBy: uploadedByUserId }, 'Image upload registered');

    // Return ONLY the public-safe fields — storageKey stays internal
    return {
      id: imageId,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
      widthPx: validation.widthPx,
      heightPx: validation.heightPx,
    };
  }

  /**
   * Mark an image as used — prevents cleanup before diagnostic completes.
   */
  async markAsUsed(imageId: string, userId: string): Promise<void> {
    // Verify the image belongs to this user before marking
    const image = await prisma.uploadedImage.findUnique({
      where: { id: imageId },
      select: { uploadedBy: true, isUsed: true },
    });

    if (!image || image.uploadedBy !== userId) {
      throw new ImageValidationError('Image not found or access denied');
    }

    if (image.isUsed) return; // Already marked — idempotent

    await prisma.uploadedImage.update({
      where: { id: imageId },
      data: { isUsed: true },
    });
  }
}

export const imageUploadService = new ImageUploadService();
