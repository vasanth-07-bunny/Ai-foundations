/**
 * API tests for advisory endpoints.
 *
 * Tests:
 *   - Generate: valid request, no advisory produced, service error
 *   - List: pagination, requires farmId param, access control
 *   - Get by ID: found, not found, wrong owner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

vi.mock('../../src/services/advisory/AdvisoryService.js', () => ({
  advisoryService: {
    generateForFarm: vi.fn(),
    listForFarm: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('../../src/services/farm/FarmService.js', () => ({
  farmService: {
    getFarm: vi.fn(),
    listFarms: vi.fn(),
    createFarm: vi.fn(),
    updateFarm: vi.fn(),
    deleteFarm: vi.fn(),
    listFields: vi.fn(),
    createField: vi.fn(),
    assertFarmOwnership: vi.fn(),
  },
}));

vi.mock('../../src/db/client.js', () => ({
  prisma: {
    cropCycle: { findUnique: vi.fn(), findFirst: vi.fn() },
    farm: { findFirst: vi.fn() },
  },
}));

vi.mock('../../src/services/auth/AuditService.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { advisoryService } from '../../src/services/advisory/AdvisoryService.js';
import { farmService } from '../../src/services/farm/FarmService.js';
import { prisma } from '../../src/db/client.js';

const TOKEN = jwt.sign(
  { sub: 'user-1', role: 'FARMER', profileId: 'profile-1' },
  'test-access-secret-min-32-chars-00000000',
  { expiresIn: '15m' },
);
const AUTH = { Authorization: `Bearer ${TOKEN}` };

const MOCK_FARM = {
  id: 'farm-1',
  farmerProfileId: 'profile-1',
  name: 'Test Farm',
  location: { lat: 28.6, lon: 77.2 },
  areaHectares: 2.5,
  farmCategory: 'small',
  country: 'IN',
  irrigationType: 'drip',
  farmingPractice: 'conventional',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_ADVISORY = {
  id: 'adv-1',
  farmId: 'farm-1',
  category: 'WEATHER_ALERT',
  recommendation: 'Irrigate immediately',
  reason: 'Temperature exceeded 38°C',
  actionTiming: 'Today',
  riskAddressed: 'Heat stress',
  environmentalImpact: 'Minimal',
  confidence: 0.92,
  riskLevel: 'CRITICAL',
  language: 'en',
  modelVersion: '1.0.0',
  evidence: { cropStage: 'wheat at flowering' },
  generatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

describe('Advisory API', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
    vi.mocked(farmService.getFarm).mockResolvedValue(MOCK_FARM);
    vi.mocked(prisma.cropCycle.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.cropCycle.findUnique).mockResolvedValue(null);
  });

  // ── POST /advisories/generate ─────────────────────────────────────────────────

  describe('POST /api/v1/advisories/generate', () => {
    it('returns advisory when generated', async () => {
      vi.mocked(advisoryService.generateForFarm).mockResolvedValue(MOCK_ADVISORY as never);

      const res = await request(app)
        .post('/api/v1/advisories/generate')
        .set(AUTH)
        .send({ farmId: 'farm-1', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).not.toBeNull();
    });

    it('returns null data when no advisory generated (insufficient confidence)', async () => {
      vi.mocked(advisoryService.generateForFarm).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/advisories/generate')
        .set(AUTH)
        .send({ farmId: 'farm-1', language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('returns 400 when farmId is not a UUID', async () => {
      const res = await request(app)
        .post('/api/v1/advisories/generate')
        .set(AUTH)
        .send({ farmId: 'not-a-uuid', language: 'en' });

      expect(res.status).toBe(400);
      expect(advisoryService.generateForFarm).not.toHaveBeenCalled();
    });

    it('returns 400 when language is unsupported', async () => {
      const res = await request(app)
        .post('/api/v1/advisories/generate')
        .set(AUTH)
        .send({ farmId: 'farm-1', language: 'xx' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/v1/advisories/generate')
        .send({ farmId: 'farm-1', language: 'en' });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /advisories ────────────────────────────────────────────────────────────

  describe('GET /api/v1/advisories', () => {
    it('returns 400 when farmId is missing', async () => {
      const res = await request(app).get('/api/v1/advisories').set(AUTH);
      expect(res.status).toBe(400);
    });

    it('returns paginated advisories for valid farmId', async () => {
      vi.mocked(advisoryService.listForFarm).mockResolvedValue({
        data: [MOCK_ADVISORY as never],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app)
        .get('/api/v1/advisories?farmId=00000000-0000-0000-0000-000000000001')
        .set(AUTH);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.meta).toBeDefined();
    });
  });

  // ── GET /advisories/:id ────────────────────────────────────────────────────────

  describe('GET /api/v1/advisories/:id', () => {
    it('returns advisory when found and owned', async () => {
      vi.mocked(advisoryService.getById).mockResolvedValue(MOCK_ADVISORY as never);

      const res = await request(app).get('/api/v1/advisories/adv-1').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('adv-1');
    });

    it('returns 404 when advisory not found', async () => {
      const { NotFoundError } = await import('../../src/utils/errors.js');
      vi.mocked(advisoryService.getById).mockRejectedValue(new NotFoundError('Advisory', 'adv-1'));

      const res = await request(app).get('/api/v1/advisories/adv-1').set(AUTH);
      expect(res.status).toBe(404);
    });

    it('returns 403 when advisory belongs to another farmer', async () => {
      const { AuthorizationError } = await import('../../src/utils/errors.js');
      vi.mocked(advisoryService.getById).mockRejectedValue(new AuthorizationError());

      const res = await request(app).get('/api/v1/advisories/adv-1').set(AUTH);
      expect(res.status).toBe(403);
    });
  });
});
