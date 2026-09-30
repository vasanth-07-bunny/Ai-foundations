/**
 * Unit tests for pagination utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  toPrismaSkipTake,
  buildPaginationMeta,
  paginate,
} from '../../../src/utils/pagination.js';

describe('toPrismaSkipTake', () => {
  it('returns skip=0, take=20 for page 1, pageSize 20', () => {
    expect(toPrismaSkipTake({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('calculates correct skip for page 2', () => {
    expect(toPrismaSkipTake({ page: 2, pageSize: 10 })).toEqual({ skip: 10, take: 10 });
  });

  it('calculates correct skip for page 5', () => {
    expect(toPrismaSkipTake({ page: 5, pageSize: 20 })).toEqual({ skip: 80, take: 20 });
  });

  it('clamps page to minimum 1', () => {
    const result = toPrismaSkipTake({ page: 0, pageSize: 20 });
    expect(result.skip).toBe(0);
  });

  it('clamps pageSize to maximum 100', () => {
    const result = toPrismaSkipTake({ page: 1, pageSize: 200 });
    expect(result.take).toBe(100);
  });

  it('clamps pageSize to minimum 1', () => {
    const result = toPrismaSkipTake({ page: 1, pageSize: 0 });
    expect(result.take).toBe(1);
  });
});

describe('buildPaginationMeta', () => {
  it('builds correct meta for first page', () => {
    const meta = buildPaginationMeta(45, { page: 1, pageSize: 20 });
    expect(meta).toEqual({ page: 1, pageSize: 20, total: 45, totalPages: 3 });
  });

  it('calculates totalPages = 1 when total fits in one page', () => {
    const meta = buildPaginationMeta(5, { page: 1, pageSize: 20 });
    expect(meta.totalPages).toBe(1);
  });

  it('calculates totalPages correctly for exact multiple', () => {
    const meta = buildPaginationMeta(100, { page: 1, pageSize: 20 });
    expect(meta.totalPages).toBe(5);
  });

  it('rounds up totalPages', () => {
    const meta = buildPaginationMeta(21, { page: 1, pageSize: 20 });
    expect(meta.totalPages).toBe(2);
  });

  it('handles zero total', () => {
    const meta = buildPaginationMeta(0, { page: 1, pageSize: 20 });
    expect(meta).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
});

describe('paginate', () => {
  it('wraps data and meta into PaginatedResponse', () => {
    const result = paginate(['a', 'b', 'c'], 50, { page: 1, pageSize: 20 });
    expect(result.data).toEqual(['a', 'b', 'c']);
    expect(result.meta.total).toBe(50);
    expect(result.meta.totalPages).toBe(3);
  });

  it('returns empty array in data for no results', () => {
    const result = paginate([], 0, { page: 1, pageSize: 20 });
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });
});
