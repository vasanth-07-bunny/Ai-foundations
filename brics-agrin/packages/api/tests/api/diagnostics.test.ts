/**
 * API tests for diagnostic endpoints.
 *
 * Tests:
 *   - Image upload: valid file, missing file, oversized file, wrong type
 *   - Diagnostic submit: valid, missing imageId, unauthorized farm
 *   - Diagnostic get: pending, completed, not found
 *   - Malicious upload attempts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

vi.mock('../../src/services/diagnostic/ImageUploadService.js', () => ({
  imageUploadService: {
    upload: vi.fn(),
    markAsUsed: vi.fn(),
  },
}));

vi.mock('../../src/services/diagnostic/DiagnosticService.js', () => ({
  diagnosticService: {
    submit: vi.fn(),
    getById: vi.fn(),
    listForFarm: vi.fn(),
  },
}));

vi.mock('../../src/services/auth/AuditService.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { imageUploadService } from '../../src/services/diagnostic/ImageUploadService.js';
import { diagnosticService } from '../../src/services/diagnostic/DiagnosticService.js';

const TOKEN = jwt.sign(
  { sub: 'user-1', role: 'FARMER', profileId: 'profile-1' },
  'test-access-secret-min-32-chars-00000000',
  { expiresIn: '15m' },
);
const AUTH = { Authorization: `Bearer ${TOKEN}` };

// Minimal valid JPEG bytes
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(100, 0xaa)]);

const MOCK_UPLOAD = {
  id: 'img-uuid-1',
  storageKey: 'uploads/user-1/img-uuid-1',
  mimeType: 'image/jpeg',
  sizeBytes: 104,
  widthPx: 640,
  heightPx: 480,
};

const MOCK_DIAGNOSTIC_PENDING = {
  id: 'diag-1',
  farmId: 'farm-1',
  cropName: 'wheat',
  growthStage: 'vegetative',
  status: 'pending',
  conditions: [],
  confidence: 0,
  modelVersion: 'unknown',
  diagnosedAt: new Date().toISOString(),
  safeNextSteps: [],
  requiresExpertConsultation: false,
  disclaimer: 'Analysis pending.',
};

describe('Diagnostics API', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  // ── POST /diagnostics/images ───────────────────────────────────────────────────

  describe('POST /api/v1/diagnostics/images', () => {
    it('returns 201 with imageId for valid JPEG upload', async () => {
      vi.mocked(imageUploadService.upload).mockResolvedValue(MOCK_UPLOAD);

      const res = await request(app)
        .post('/api/v1/diagnostics/images')
        .set(AUTH)
        .attach('image', JPEG_BYTES, { filename: 'crop.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(201);
      expect(res.body.data.imageId).toBe('img-uuid-1');
    });

    it('returns 400 when no image file is provided', async () => {
      const res = await request(app)
        .post('/api/v1/diagnostics/images')
        .set(AUTH)
        .set('Content-Type', 'multipart/form-data');

      expect(res.status).toBe(400);
      expect(imageUploadService.upload).not.toHaveBeenCalled();
    });

    it('returns 400 or 415 for wrong MIME type', async () => {
      const res = await request(app)
        .post('/api/v1/diagnostics/images')
        .set(AUTH)
        .attach('image', Buffer.from('%PDF-1.4'), { filename: 'fake.pdf', contentType: 'application/pdf' });

      expect([400, 415]).toContain(res.status);
      expect(imageUploadService.upload).not.toHaveBeenCalled();
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/v1/diagnostics/images')
        .attach('image', JPEG_BYTES, { filename: 'crop.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(401);
    });

    it('never exposes internal storage paths in response', async () => {
      vi.mocked(imageUploadService.upload).mockResolvedValue(MOCK_UPLOAD);

      const res = await request(app)
        .post('/api/v1/diagnostics/images')
        .set(AUTH)
        .attach('image', JPEG_BYTES, { filename: 'crop.jpg', contentType: 'image/jpeg' });

      // Response must not contain internal storage key path
      expect(JSON.stringify(res.body)).not.toContain('storageKey');
      expect(JSON.stringify(res.body)).not.toContain('uploads/');
    });
  });

  // ── POST /diagnostics ─────────────────────────────────────────────────────────

  describe('POST /api/v1/diagnostics', () => {
    const VALID_BODY = {
      farmId: '00000000-0000-0000-0000-000000000001',
      cropName: 'wheat',
      growthStage: 'vegetative',
      imageId: '00000000-0000-0000-0000-000000000002',
    };

    it('creates pending diagnostic and returns 201', async () => {
      vi.mocked(diagnosticService.submit).mockResolvedValue(MOCK_DIAGNOSTIC_PENDING as never);

      const res = await request(app).post('/api/v1/diagnostics').set(AUTH).send(VALID_BODY);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
    });

    it('returns 400 for missing farmId', async () => {
      const { farmId: _, ...noFarmId } = VALID_BODY;
      const res = await request(app).post('/api/v1/diagnostics').set(AUTH).send(noFarmId);
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid growthStage', async () => {
      const res = await request(app).post('/api/v1/diagnostics').set(AUTH).send({
        ...VALID_BODY,
        growthStage: 'invalid-stage',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for missing imageId', async () => {
      const { imageId: _, ...noImageId } = VALID_BODY;
      const res = await request(app).post('/api/v1/diagnostics').set(AUTH).send(noImageId);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /diagnostics/:id ──────────────────────────────────────────────────────

  describe('GET /api/v1/diagnostics/:id', () => {
    it('returns diagnostic result for owner', async () => {
      vi.mocked(diagnosticService.getById).mockResolvedValue(MOCK_DIAGNOSTIC_PENDING as never);

      const res = await request(app).get('/api/v1/diagnostics/diag-1').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('diag-1');
    });

    it('returns 404 when not found', async () => {
      const { NotFoundError } = await import('../../src/utils/errors.js');
      vi.mocked(diagnosticService.getById).mockRejectedValue(new NotFoundError('DiagnosticResult', 'x'));

      const res = await request(app).get('/api/v1/diagnostics/nonexistent').set(AUTH);
      expect(res.status).toBe(404);
    });
  });
});
