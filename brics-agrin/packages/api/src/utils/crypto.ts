/**
 * Cryptographic utilities.
 * Centralised so algorithms and cost factors are set in one place.
 */

import crypto from 'crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plaintext: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/** SHA-256 hex digest of a Buffer or string */
export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** Generate a cryptographically random token (URL-safe base64) */
export function generateSecureToken(byteLength = 48): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

/** Constant-time string comparison to prevent timing attacks */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
