/**
 * API tests for farm endpoints.
 *
 * Tests:
 *   - CRUD happy paths
 *   - Auth enforcement
 *   - Validation — missing fields, bad coordinates, negative area
 *   - Pagination on list
 *   - Consistent error envelopes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

vi.mock('../../src/services/farm/FarmService.js', () => ({
  farmService: {
    listFarms: vi.fn(),
    createFarm: vi.fn(),
    getFarm: vi.fn(),
    updateFarm: vi.fn(),
    deleteFarm: vi.fn(),
    listFields: vi.fn(),
    createField: vi.fn(),
    assertFarmOwnership: vi.fn(),
  },
}));

vi.mock('../../src/services/auth/AuditService.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { farmService } from '../../src/services/farm/FarmService.js';

const TOKEN = jwt.sign(
  { sub: 'user-1', role: 'FARMER', profileId: 'profile-1' },
  'test-access-secret-min-32-chars-00000000',
  { expiresIn: '15m' },
);

const AUTH = { Authorization: `Bearer ${TOKEN}` };

const MOCK_FARM = {
  id: 'farm-uuid-1',
  farmerProfileId: 'profile-1',
  name: 'Test Farm',
  location: { lat: 28.6139, lon: 77.2090 },
  areaHectares: 2.5,
  farmCategory: 'small',
  country: 'IN',
  irrigationType: 'drip',
  farmingPractice: 'conventional',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const PAGINATED_EMPTY = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

describe('Farm API', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  // ── GET /farms ────────────────────────────────────────────────────────────────

  describe('GET /api/v1/farms', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/farms');
      expect(res.status).toBe(401);
    });

    it('returns paginated empty list when no farms', async () => {
      vi.mocked(farmService.listFarms).mockResolvedValue(PAGINATED_EMPTY);

      const res = await request(app).get('/api/v1/farms').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('passes page and pageSize to service', async () => {
      vi.mocked(farmService.listFarms).mockResolvedValue(PAGINATED_EMPTY);

      await request(app).get('/api/v1/farms?page=2&pageSize=10').set(AUTH);
      expect(farmService.listFarms).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });

    it('returns 400 for invalid page param', async () => {
      const res = await request(app).get('/api/v1/farms?page=-1').set(AUTH);
      expect(res.status).toBe(400);
    });
  });

  // ── POST /farms ───────────────────────────────────────────────────────────────

  describe('POST /api/v1/farms', () => {
    const VALID_BODY = {
      name: 'Test Farm',
      location: { lat: 28.6139, lon: 77.2090 },
      areaHectares: 2.5,
      country: 'IN',
      irrigationType: 'drip',
      farmingPractice: 'conventional',
    };

    it('creates a farm and returns 201', async () => {
      vi.mocked(farmService.createFarm).mockResolvedValue(MOCK_FARM);

      const res = await request(app).post('/api/v1/farms').set(AUTH).send(VALID_BODY);
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('farm-uuid-1');
      expect(res.body.data.name).toBe('Test Farm');
    });

    it('returns 400 for missing name', async () => {
      const { name: _, ...noName } = VALID_BODY;
      const res = await request(app).post('/api/v1/farms').set(AUTH).send(noName);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveProperty('name');
    });

    it('returns 400 for invalid latitude', async () => {
      const res = await request(app).post('/api/v1/farms').set(AUTH).send({
        ...VALID_BODY,
        location: { lat: 200, lon: 0 }, // latitude > 90
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for negative area', async () => {
      const res = await request(app).post('/api/v1/farms').set(AUTH).send({
        ...VALID_BODY,
        areaHectares: -1,
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid country code', async () => {
      const res = await request(app).post('/api/v1/farms').set(AUTH).send({
        ...VALID_BODY,
        country: 'XX',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid irrigation type', async () => {
      const res = await request(app).post('/api/v1/farms').set(AUTH).send({
        ...VALID_BODY,
        irrigationType: 'laser-beam',
      });
      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/farms').send(VALID_BODY);
      expect(res.status).toBe(401);
    });

    it('does not expose 500 on service error', async () => {
      vi.mocked(farmService.createFarm).mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).post('/api/v1/farms').set(AUTH).send(VALID_BODY);
      expect(res.status).toBe(500);
      // Must not expose internal error details
      expect(res.body.error.message).not.toContain('DB connection');
      expect(res.body.error.message).not.toContain('lost');
    });
  });

  // ── GET /farms/:id ────────────────────────────────────────────────────────────

  describe('GET /api/v1/farms/:farmId', () => {
    it('returns farm when found', async () => {
      vi.mocked(farmService.getFarm).mockResolvedValue(MOCK_FARM);

      const res = await request(app).get('/api/v1/farms/farm-uuid-1').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('farm-uuid-1');
    });

    it('returns 403 when farm not owned by user', async () => {
      const { AuthorizationError } = await import('../../src/utils/errors.js');
      vi.mocked(farmService.getFarm).mockRejectedValue(
        new AuthorizationError('Farm not found or access denied'),
      );

      const res = await request(app).get('/api/v1/farms/other-farm').set(AUTH);
      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /farms/:id ─────────────────────────────────────────────────────────

  describe('DELETE /api/v1/farms/:farmId', () => {
    it('returns 204 on successful deletion', async () => {
      vi.mocked(farmService.deleteFarm).mockResolvedValue(undefined);

      const res = await request(app).delete('/api/v1/farms/farm-uuid-1').set(AUTH);
      expect(res.status).toBe(204);
    });
  });
});
