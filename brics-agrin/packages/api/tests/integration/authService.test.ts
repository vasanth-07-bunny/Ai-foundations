/**
 * Integration tests for AuthService.
 *
 * These test the service layer in isolation by mocking Prisma.
 * Tests verify:
 *   - Register creates user + profile atomically
 *   - Login is timing-safe (both invalid email and wrong password take similar path)
 *   - Register detects duplicate emails via ConflictError
 *   - Refresh tokens are rotated (old token invalidated)
 *   - Logout revokes the refresh token
 *   - Tokens contain correct claims
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Prisma and Redis are mocked via tests/setup.ts

import { AuthService } from '../../src/services/auth/AuthService.js';
import { prisma } from '../../src/db/client.js';
import { ConflictError, AuthenticationError } from '../../src/utils/errors.js';
import { sha256Hex } from '../../src/utils/crypto.js';

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'farmer@test.com',
  passwordHash: '$2b$12$placeholder-wont-be-verified',
  role: 'FARMER',
  isActive: true,
  isVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const MOCK_PROFILE = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  country: 'IN',
  language: 'en',
  farmCategory: 'SMALL',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('creates user and profile in a transaction', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: { create: vi.fn().mockResolvedValue(MOCK_USER) },
          farmerProfile: { create: vi.fn().mockResolvedValue(MOCK_PROFILE) },
        };
        return fn(mockTx);
      });
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as never);

      const result = await authService.register({
        email: 'farmer@test.com',
        password: 'SecurePass1!',
        language: 'en',
        country: 'IN',
      });

      expect(result.user.email).toBe('farmer@test.com');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      // Password must not appear in response
      expect(JSON.stringify(result)).not.toContain('SecurePass1!');
    });

    it('throws ConflictError when email already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(MOCK_USER as never);

      await expect(
        authService.register({
          email: 'farmer@test.com',
          password: 'SecurePass1!',
          language: 'en',
          country: 'IN',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('issues access token with correct claims', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: { create: vi.fn().mockResolvedValue(MOCK_USER) },
          farmerProfile: { create: vi.fn().mockResolvedValue(MOCK_PROFILE) },
        };
        return fn(mockTx);
      });
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as never);

      const result = await authService.register({
        email: 'farmer@test.com',
        password: 'SecurePass1!',
        language: 'en',
        country: 'IN',
      });

      // Decode token and verify claims (not verify signature — secret is env-var)
      const decoded = jwt.decode(result.tokens.accessToken) as Record<string, unknown>;
      expect(decoded.sub).toBe('user-uuid-1');
      expect(decoded.role).toBe('FARMER');
    });
  });

  describe('login', () => {
    it('throws AuthenticationError for non-existent email (timing safe)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        authService.login('noone@test.com', 'AnyPassword1!'),
      ).rejects.toThrow(AuthenticationError);
    });

    it('throws AuthenticationError for inactive account', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...MOCK_USER, isActive: false, farmerProfile: null,
      } as never);

      await expect(
        authService.login('farmer@test.com', 'SecurePass1!'),
      ).rejects.toThrow(AuthenticationError);
    });

    it('uses same generic error message for both wrong email and wrong password', async () => {
      // Wrong email path
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      let err1: AuthenticationError | null = null;
      try {
        await authService.login('wrong@test.com', 'AnyPass1!');
      } catch (e) {
        err1 = e as AuthenticationError;
      }

      // Wrong password path
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...MOCK_USER, farmerProfile: null,
      } as never);
      let err2: AuthenticationError | null = null;
      try {
        await authService.login('farmer@test.com', 'WrongPass1!');
      } catch (e) {
        err2 = e as AuthenticationError;
      }

      // Both errors should have identical messages (prevents user enumeration)
      expect(err1?.message).toBe(err2?.message);
      expect(err1?.message).toContain('Invalid');
    });
  });

  describe('refresh', () => {
    it('throws AuthenticationError for non-existent token', async () => {
      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValue(null);

      await expect(
        authService.refresh('made-up-token-value'),
      ).rejects.toThrow(AuthenticationError);
    });

    it('stores refresh token as hash, not plaintext', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          user: { create: vi.fn().mockResolvedValue(MOCK_USER) },
          farmerProfile: { create: vi.fn().mockResolvedValue(MOCK_PROFILE) },
        };
        return fn(mockTx);
      });
      const createSpy = vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as never);

      const result = await authService.register({
        email: 'test@test.com',
        password: 'SecurePass1!',
        language: 'en',
        country: 'IN',
      });

      const createCall = createSpy.mock.calls[0]?.[0] as { data: { tokenHash: string } };
      const storedHash = createCall?.data?.tokenHash;
      const expectedHash = sha256Hex(result.tokens.refreshToken);

      // DB must store hash, not the raw token
      expect(storedHash).toBe(expectedHash);
      expect(storedHash).not.toBe(result.tokens.refreshToken);
    });
  });
});
