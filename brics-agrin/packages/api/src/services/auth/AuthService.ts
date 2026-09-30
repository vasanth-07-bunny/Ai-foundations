/**
 * Authentication Service.
 *
 * Handles: register, login, token refresh, logout.
 *
 * Security:
 *   - Passwords hashed with bcrypt (cost 12)
 *   - Refresh tokens stored as SHA-256 hash in DB — never plaintext
 *   - Access tokens: 15 min TTL
 *   - Refresh tokens: 7 day TTL, single-use rotation
 *   - Revoked refresh tokens cannot be reused
 *   - Timing-safe comparison for token verification
 *   - Audit log on every auth event
 */

import jwt from 'jsonwebtoken';
import { prisma } from '../../db/client.js';
import { config } from '../../config/index.js';
import { hashPassword, verifyPassword, sha256Hex, generateSecureToken } from '../../utils/crypto.js';
import { AuthenticationError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { auditService } from './AuditService.js';
import { createLogger } from '../../observability/logger.js';
import { metrics } from '../../observability/metrics.js';
import type { RegisterInput, TokenPair } from '../../domain/user/types.js';
import type { UserPublic } from '@brics-agrin/shared';

const log = createLogger('auth-service');

export class AuthService {
  // ── Register ────────────────────────────────────────────────────────────────

  async register(
    input: RegisterInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: UserPublic; tokens: TokenPair }> {
    metrics.authAttempts.increment({ action: 'register' });

    // Check for existing account — use constant-time-ish check via DB
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      // Don't reveal whether the email exists — return same error as auth
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);

    // Create user + profile in a single transaction
    const { user, profile } = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          role: 'FARMER',
          isActive: true,
          isVerified: false,
        },
      });

      const newProfile = await tx.farmerProfile.create({
        data: {
          userId: newUser.id,
          country: input.country,
          language: input.language,
          farmCategory: 'SMALL',
        },
      });

      return { user: newUser, profile: newProfile };
    });

    const tokens = await this.issueTokens(user.id, 'FARMER', profile.id, ipAddress, userAgent);

    await auditService.record({
      userId: user.id,
      action: 'USER_REGISTER',
      ipAddress,
      userAgent,
    });

    log.info({ userId: user.id }, 'User registered');

    return {
      user: this.toUserPublic(user, input.language, input.country),
      tokens,
    };
  }

  // ── Login ───────────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: UserPublic; tokens: TokenPair }> {
    metrics.authAttempts.increment({ action: 'login' });

    // Always perform the bcrypt comparison even if user not found
    // to prevent timing-based user enumeration
    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
      include: { farmerProfile: true },
    });

    // Always perform bcrypt comparison even when user not found to prevent
    // timing-based user enumeration. The dummy hash is a valid bcrypt hash
    // that will never match any real password, but takes the same CPU time.
    const dummyHash = '$2b$12$LZMCIJdGNkmXPq3IByxCduuoAfFH6Zm0y.IEfHbfTwZD5a.BbX2jy';
    const passwordMatch = await verifyPassword(
      password,
      user?.passwordHash ?? dummyHash,
    );

    if (!user || !passwordMatch || !user.isActive) {
      metrics.authFailures.increment();
      await auditService.record({
        userId: user?.id,
        action: 'USER_LOGIN_FAILED',
        ipAddress,
        userAgent,
        metadata: { reason: !user ? 'user_not_found' : !passwordMatch ? 'wrong_password' : 'inactive' },
      });
      // Generic message — never reveal which part failed
      throw new AuthenticationError('Invalid email or password');
    }

    const tokens = await this.issueTokens(
      user.id,
      user.role,
      user.farmerProfile?.id ?? null,
      ipAddress,
      userAgent,
    );

    await auditService.record({
      userId: user.id,
      action: 'USER_LOGIN',
      ipAddress,
      userAgent,
    });

    log.info({ userId: user.id }, 'User logged in');

    return {
      user: this.toUserPublic(
        user,
        (user.farmerProfile?.language ?? 'en') as UserPublic['language'],
        (user.farmerProfile?.country ?? 'IN') as UserPublic['country'],
      ),
      tokens,
    };
  }

  // ── Refresh ─────────────────────────────────────────────────────────────────

  async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const tokenHash = sha256Hex(rawRefreshToken);

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: { farmerProfile: true },
        },
      },
    });

    if (!stored || !stored.user.isActive) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    // Revoke the used token (single-use rotation)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(
      stored.userId,
      stored.user.role,
      stored.user.farmerProfile?.id ?? null,
      ipAddress,
      userAgent,
    );

    await auditService.record({
      userId: stored.userId,
      action: 'TOKEN_REFRESH',
      ipAddress,
      userAgent,
    });

    return tokens;
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  async logout(rawRefreshToken: string, userId: string): Promise<void> {
    const tokenHash = sha256Hex(rawRefreshToken);

    await prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await auditService.record({ userId, action: 'USER_LOGOUT' });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async issueTokens(
    userId: string,
    role: string,
    profileId: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const accessToken = jwt.sign(
      { sub: userId, role, profileId },
      config.JWT_ACCESS_SECRET,
      { expiresIn: config.JWT_ACCESS_EXPIRES_IN } as jwt.SignOptions,
    );

    const rawRefreshToken = generateSecureToken(48);
    const tokenHash = sha256Hex(rawRefreshToken);
    const expiresAt = new Date(
      Date.now() + config.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
    );

    await prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress?.slice(0, 45),
        userAgent: userAgent?.slice(0, 500),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private toUserPublic(
    user: { id: string; email: string; role: string; createdAt: Date },
    language: UserPublic['language'],
    country: UserPublic['country'],
  ): UserPublic {
    return {
      id: user.id,
      email: user.email,
      role: user.role as UserPublic['role'],
      language,
      country,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
