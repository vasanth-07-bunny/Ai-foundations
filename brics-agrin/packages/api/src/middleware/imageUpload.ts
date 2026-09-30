/**
 * Multer middleware for crop disease image uploads.
 *
 * Security:
 *   - Memory storage only — images are NEVER written to disk
 *   - File size enforced by multer before reaching validation layer
 *   - MIME type checked at multer level (first gate) then again in ImageValidator (second gate)
 *   - Only one file per request
 *   - Field name must be exactly 'image'
 *
 * The buffer is passed to ImageValidator and ImageUploadService for
 * further validation and secure storage.
 */

import multer from 'multer';
import { config } from '../config/index.js';

const memoryStorage = multer.memoryStorage();

export const imageUploadMiddleware = multer({
  storage: memoryStorage,
  limits: {
    fileSize: config.IMAGE_MAX_SIZE_BYTES,
    files: 1,            // Only one file per upload request
    fields: 5,           // Limit non-file fields
  },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.toLowerCase().trim();
    if (config.IMAGE_ALLOWED_MIME_TYPES.includes(mime)) {
      cb(null, true);
    } else {
      // Reject immediately — don't buffer the file
      cb(new Error(`File type '${mime}' is not accepted`));
    }
  },
}).single('image');

/**
 * Express middleware wrapper that converts multer errors to our error format.
 */
export function handleImageUpload(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
): void {
  imageUploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new Error(
            `File size exceeds the maximum allowed (${(config.IMAGE_MAX_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB)`,
          ),
        );
      }
      return next(new Error(`Upload error: ${err.message}`));
    }
    if (err) {
      return next(err);
    }
    next();
  });
}
