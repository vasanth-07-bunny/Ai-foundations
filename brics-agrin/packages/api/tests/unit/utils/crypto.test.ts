/**
 * Unit tests for cryptographic utilities.
 * These are pure functions — deterministic and side-effect free.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  sha256Hex,
  generateSecureToken,
  timingSafeEqual,
} from '../../../src/utils/crypto.js';

describe('sha256Hex', () => {
  it('produces a 64-character hex string', () => {
    const hash = sha256Hex('test-input');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same output for the same input (deterministic)', () => {
    expect(sha256Hex('same')).toBe(sha256Hex('same'));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256Hex('input-a')).not.toBe(sha256Hex('input-b'));
  });

  it('accepts a Buffer as input', () => {
    const hash = sha256Hex(Buffer.from('hello'));
    expect(hash).toHaveLength(64);
  });

  it('is sensitive to even a single character difference', () => {
    expect(sha256Hex('password1')).not.toBe(sha256Hex('password2'));
  });
});

describe('hashPassword / verifyPassword', () => {
  it('hashes a password and verifies it correctly', async () => {
    const plain = 'SecurePass1!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2b\$/);  // bcrypt format
    await expect(verifyPassword(plain, hash)).resolves.toBe(true);
  });

  it('rejects incorrect password', async () => {
    const hash = await hashPassword('CorrectPass1!');
    await expect(verifyPassword('WrongPass1!', hash)).resolves.toBe(false);
  });

  it('produces different hashes for the same password (salted)', async () => {
    const hash1 = await hashPassword('SamePass1!');
    const hash2 = await hashPassword('SamePass1!');
    expect(hash1).not.toBe(hash2);  // Different salts
  });

  it('never stores password in plaintext within hash output', async () => {
    const plain = 'MyPlainPassword1!';
    const hash = await hashPassword(plain);
    expect(hash).not.toContain(plain);
  });
}, { timeout: 15000 }); // bcrypt is intentionally slow

describe('generateSecureToken', () => {
  it('generates a non-empty URL-safe string', () => {
    const token = generateSecureToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);  // URL-safe base64
  });

  it('generates unique tokens on every call', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });

  it('respects the requested byte length', () => {
    const token16 = generateSecureToken(16);
    const token48 = generateSecureToken(48);
    // Base64url encodes 3 bytes as 4 chars → 16 bytes = ~22 chars, 48 bytes = ~64 chars
    expect(token48.length).toBeGreaterThan(token16.length);
  });
});

describe('timingSafeEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeEqual('secret-token', 'secret-token')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(timingSafeEqual('aaaaaaa', 'aaaaaab')).toBe(false);
  });

  it('returns false for strings of different lengths (no timing leak)', () => {
    expect(timingSafeEqual('short', 'much-longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqual('', 'notempty')).toBe(false);
  });

  it('returns true for empty vs empty', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });
});
