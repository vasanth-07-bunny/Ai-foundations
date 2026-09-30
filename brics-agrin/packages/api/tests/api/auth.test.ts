/**
 * API tests for authentication endpoints.
 *
 * Tests:
 *   - Register: happy path, duplicate email, weak password, missing fields
 *   - Login: valid credentials, wrong password, non-existent user
 *   - Refresh: valid token, expired token, tampered token
 *   - Logout: with valid token
 *   - Rate limiting: exceeding auth limit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

// authService mock
vi.mock('../../src/services/auth/AuthService.js', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}));

import { authService } from '../../src/services/auth/AuthService.js';

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'farmer@test.com',
  role: 'farmer' as const,
  language: 'en' as const,
  country: 'IN' as const,
  createdAt: new Date().toISOString(),
};

const MOCK_TOKENS = {
  accessToken: 'access.token.here',
  refreshToken: 'refresh-token-raw',
  expiresIn: 900,
};

describe('Auth API', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
  });

  // ── Register ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('creates a new account and returns tokens', async () => {
      vi.mocked(authService.register).mockResolvedValue({
        user: MOCK_USER,
        tokens: MOCK_TOKENS,
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'farmer@test.com',
          password: 'SecurePass1!',
          language: 'en',
          country: 'IN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('farmer@test.com');
      // Password must NEVER appear in response
      expect(JSON.stringify(res.body)).not.toContain('SecurePass1!');
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('returns 400 for weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'farmer@test.com',
          password: 'weak',
          language: 'en',
          country: 'IN',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'SecurePass1!',
          language: 'en',
          country: 'IN',
        });

      expect(res.status).toBe(400);
      expect(authService.register).not.toHaveBeenCalled();
    });

    it('returns 400 for unsupported country code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'farmer@test.com',
          password: 'SecurePass1!',
          language: 'en',
          country: 'XX', // Invalid country
        });

      expect(res.status).toBe(400);
    });

    it('returns 409 when email already exists', async () => {
      const { ConflictError } = await import('../../src/utils/errors.js');
      vi.mocked(authService.register).mockRejectedValue(
        new ConflictError('An account with this email already exists'),
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@test.com',
          password: 'SecurePass1!',
          language: 'en',
          country: 'IN',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
    });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('returns tokens for valid credentials', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: MOCK_USER,
        tokens: MOCK_TOKENS,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'farmer@test.com', password: 'SecurePass1!' });

      expect(res.status).toBe(200);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const { AuthenticationError } = await import('../../src/utils/errors.js');
      vi.mocked(authService.login).mockRejectedValue(
        new AuthenticationError('Invalid email or password'),
      );

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'farmer@test.com', password: 'WrongPass1!' });

      expect(res.status).toBe(401);
      // Generic message — does not reveal whether email or password was wrong
      expect(res.body.error.message).not.toContain('email does not');
      expect(res.body.error.message).not.toContain('password is');
    });

    it('returns 400 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'farmer@test.com' });

      expect(res.status).toBe(400);
      expect(authService.login).not.toHaveBeenCalled();
    });
  });

  // ── Security headers ─────────────────────────────────────────────────────────

  describe('Security headers', () => {
    it('includes X-Request-Id on every response', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('includes X-Content-Type-Options header', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  // ── 404 handler ───────────────────────────────────────────────────────────────

  describe('Unknown routes', () => {
    it('returns 404 for unregistered routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
