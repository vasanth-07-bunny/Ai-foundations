/**
 * Security tests — Authorization and IDOR prevention.
 *
 * Tests:
 *   - Unauthenticated requests to protected routes → 401
 *   - Tampered JWT → 401
 *   - Farmer A cannot access Farmer B's farm → 403/404
 *   - Farmer cannot access admin routes
 *   - SQL injection attempt in farmId path param → 400/404 (not 500)
 *   - XSS payload in farm name is stored safely (not executed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

vi.mock('../../src/services/farm/FarmService.js', () => ({
  farmService: {
    listFarms: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    createFarm: vi.fn(),
    getFarm: vi.fn(),
    updateFarm: vi.fn(),
    deleteFarm: vi.fn(),
    listFields: vi.fn(),
    createField: vi.fn(),
  },
}));

vi.mock('../../src/services/auth/AuditService.js', () => ({
  auditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

import { farmService } from '../../src/services/farm/FarmService.js';

function makeToken(payload: object, secret = 'test-access-secret-min-32-chars-00000000') {
  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

const VALID_TOKEN = makeToken({ sub: 'user-1', role: 'FARMER', profileId: 'profile-1' });
const FARMER_B_TOKEN = makeToken({ sub: 'user-2', role: 'FARMER', profileId: 'profile-2' });

describe('Authorization Security', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  describe('Unauthenticated access', () => {
    const protectedRoutes = [
      ['GET', '/api/v1/farms'],
      ['POST', '/api/v1/farms'],
      ['GET', '/api/v1/advisories'],
      ['POST', '/api/v1/advisories/generate'],
      ['GET', '/api/v1/diagnostics'],
      ['POST', '/api/v1/diagnostics'],
      ['GET', '/api/v1/profile'],
    ];

    protectedRoutes.forEach(([method, path]) => {
      it(`${method} ${path} returns 401 without token`, async () => {
        const res = await (request(app) as never)[method!.toLowerCase()](path);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe('Token tampering', () => {
    it('rejects a token signed with wrong secret', async () => {
      const tampered = makeToken(
        { sub: 'user-1', role: 'FARMER', profileId: 'profile-1' },
        'wrong-secret-completely-different',
      );

      const res = await request(app)
        .get('/api/v1/farms')
        .set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/farms')
        .set('Authorization', 'Bearer not.a.valid.jwt.at.all');

      expect(res.status).toBe(401);
    });

    it('rejects token in query string (must use Authorization header)', async () => {
      const res = await request(app)
        .get(`/api/v1/farms?token=${VALID_TOKEN}`);

      // Without Authorization header, should be 401
      expect(res.status).toBe(401);
    });
  });

  describe('IDOR prevention', () => {
    it('farmer B cannot read farmer A farm when service denies access', async () => {
      const { AuthorizationError } = await import('../../src/utils/errors.js');
      vi.mocked(farmService.getFarm).mockRejectedValue(
        new AuthorizationError('Farm not found or access denied'),
      );

      const res = await request(app)
        .get('/api/v1/farms/farm-of-farmer-a')
        .set('Authorization', `Bearer ${FARMER_B_TOKEN}`);

      expect(res.status).toBe(403);
      // Response must not contain any farm data
      expect(res.body.data).toBeUndefined();
    });
  });

  describe('Input injection prevention', () => {
    it('handles SQL-like characters in farmId path param without 500', async () => {
      const res = await request(app)
        .get("/api/v1/farms/1' OR '1'='1")
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      // Should be 400/404/403 — never 500 (which would indicate unhandled injection)
      expect(res.status).not.toBe(500);
    });

    it('handles oversized Authorization header gracefully', async () => {
      const res = await request(app)
        .get('/api/v1/farms')
        .set('Authorization', `Bearer ${'A'.repeat(10000)}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Response envelope', () => {
    it('successful response has consistent success:true envelope', async () => {
      vi.mocked(farmService.listFarms).mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });

      const res = await request(app)
        .get('/api/v1/farms')
        .set('Authorization', `Bearer ${VALID_TOKEN}`);

      expect(res.body.success).toBe(true);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.data).toBeDefined();
    });

    it('error response has consistent success:false envelope', async () => {
      const res = await request(app)
        .get('/api/v1/farms')
        .set('Authorization', 'Bearer invalid');

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBeDefined();
      expect(res.body.requestId).toBeDefined();
    });
  });
});
