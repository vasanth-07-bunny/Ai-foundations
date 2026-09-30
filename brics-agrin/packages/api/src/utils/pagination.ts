/**
 * Pagination utilities — consistent across all list endpoints.
 */

import type { PaginationMeta, PaginatedResponse } from '@brics-agrin/shared';
import { PAGINATION_DEFAULTS } from '@brics-agrin/shared';

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export interface PrismaSkipTake {
  skip: number;
  take: number;
}

/**
 * Convert page/pageSize to Prisma skip/take.
 * Clamps values to safe limits.
 */
export function toPrismaSkipTake(pagination: PaginationInput): PrismaSkipTake {
  const page = Math.max(1, pagination.page);
  const pageSize = Math.min(
    Math.max(1, pagination.pageSize),
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
  );
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/** Build the pagination metadata for a response envelope. */
export function buildPaginationMeta(
  total: number,
  pagination: PaginationInput,
): PaginationMeta {
  const pageSize = Math.min(
    Math.max(1, pagination.pageSize),
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
  );
  const page = Math.max(1, pagination.page);
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

/** Wrap a list + count into a paginated response. */
export function paginate<T>(
  data: T[],
  total: number,
  pagination: PaginationInput,
): PaginatedResponse<T> {
  return {
    data,
    meta: buildPaginationMeta(total, pagination),
  };
}
