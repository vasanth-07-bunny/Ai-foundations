/**
 * Unit tests for ImageValidator.
 *
 * Critical security tests:
 *   - Valid JPEG passes
 *   - Valid PNG passes
 *   - Oversized file rejected
 *   - Disallowed MIME type rejected
 *   - Magic bytes mismatch rejected (spoofed extension)
 *   - Corrupt file rejected
 *   - Too-small image rejected
 *   - Too-large dimensions rejected
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp before importing the validator
vi.mock('sharp', () => {
  return {
    default: vi.fn(() => ({
      metadata: vi.fn().mockResolvedValue({ width: 640, height: 480 }),
    })),
  };
});

import { ImageValidator } from '../../../../src/services/diagnostic/ImageValidator.js';

// Real JPEG magic bytes
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(100)]);
// Real PNG magic bytes
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(100)]);
// Spoofed: PNG magic but claiming JPEG
const SPOOFED_JPEG = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.alloc(100)]);

describe('ImageValidator', () => {
  let validator: ImageValidator;

  beforeEach(() => {
    validator = new ImageValidator();
    vi.clearAllMocks();
  });

  it('accepts a valid JPEG buffer with correct magic bytes', async () => {
    const result = await validator.validate(JPEG_MAGIC, 'image/jpeg');
    expect(result.isValid).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.widthPx).toBe(640);
    expect(result.heightPx).toBe(480);
  });

  it('accepts a valid PNG buffer', async () => {
    const result = await validator.validate(PNG_MAGIC, 'image/png');
    expect(result.isValid).toBe(true);
  });

  it('rejects a file that exceeds the maximum size', async () => {
    const oversized = Buffer.alloc(11 * 1024 * 1024); // 11 MB
    const result = await validator.validate(oversized, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('size');
  });

  it('rejects a disallowed MIME type', async () => {
    const result = await validator.validate(JPEG_MAGIC, 'application/pdf');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('not accepted');
  });

  it('rejects a file with mismatched magic bytes (spoofed extension)', async () => {
    // PNG bytes but claiming to be JPEG
    const result = await validator.validate(SPOOFED_JPEG, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('does not match');
  });

  it('rejects an image with dimensions too large', async () => {
    const { default: sharp } = await import('sharp');
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockResolvedValue({ width: 5000, height: 5000 }),
    } as never);

    const result = await validator.validate(JPEG_MAGIC, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('exceed');
  });

  it('rejects an image with dimensions too small', async () => {
    const { default: sharp } = await import('sharp');
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
    } as never);

    const result = await validator.validate(JPEG_MAGIC, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('too small');
  });

  it('rejects a corrupt file that sharp cannot decode', async () => {
    const { default: sharp } = await import('sharp');
    vi.mocked(sharp).mockReturnValue({
      metadata: vi.fn().mockRejectedValue(new Error('Input buffer contains unsupported image format')),
    } as never);

    const result = await validator.validate(JPEG_MAGIC, 'image/jpeg');
    expect(result.isValid).toBe(false);
    expect(result.rejectionReason).toContain('decoded');
  });

  it('normalizes MIME type to lowercase', async () => {
    const result = await validator.validate(JPEG_MAGIC, 'IMAGE/JPEG');
    expect(result.mimeType).toBe('image/jpeg');
  });
});
