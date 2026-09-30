/**
 * Unit tests for dataFreshness utilities.
 * These are deterministic — no external dependencies.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFreshness,
  isDataUsable,
  buildStalenessNotice,
} from '../../../src/utils/dataFreshness.js';

describe('classifyFreshness', () => {
  it('classifies data less than 3 hours old as current', () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    expect(classifyFreshness(recent)).toBe('current');
  });

  it('classifies data 4–23 hours old as recent', () => {
    const old = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10h ago
    expect(classifyFreshness(old)).toBe('recent');
  });

  it('classifies data 25–71 hours old as stale', () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
    expect(classifyFreshness(stale)).toBe('stale');
  });

  it('classifies data older than 72 hours as expired', () => {
    const expired = new Date(Date.now() - 96 * 60 * 60 * 1000); // 96h ago
    expect(classifyFreshness(expired)).toBe('expired');
  });

  it('accepts ISO string timestamps', () => {
    const isoString = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(classifyFreshness(isoString)).toBe('current');
  });
});

describe('isDataUsable', () => {
  it('returns true for current data', () => {
    const now = new Date(Date.now() - 1000);
    expect(isDataUsable(now)).toBe(true);
  });

  it('returns false for expired data', () => {
    const old = new Date(Date.now() - 100 * 60 * 60 * 1000);
    expect(isDataUsable(old)).toBe(false);
  });
});

describe('buildStalenessNotice', () => {
  it('returns null for current data', () => {
    expect(buildStalenessNotice('current')).toBeNull();
  });

  it('returns a warning string for stale data', () => {
    const notice = buildStalenessNotice('stale');
    expect(notice).toContain('24 hours');
  });

  it('returns an expiry message for expired data', () => {
    const notice = buildStalenessNotice('expired');
    expect(notice).toContain('expired');
  });
});
