/**
 * Data freshness classification.
 *
 * Every piece of external data should be tagged with its freshness so
 * the advisory engine and API responses never silently present stale
 * data as current.
 */

import type { DataFreshness } from '@brics-agrin/shared';

/** Freshness thresholds in milliseconds */
const FRESHNESS_THRESHOLDS = {
  CURRENT_MS: 3 * 60 * 60 * 1000,   // < 3 hours = current
  RECENT_MS: 24 * 60 * 60 * 1000,   // < 24 hours = recent
  STALE_MS: 72 * 60 * 60 * 1000,    // < 72 hours = stale
  // > 72 hours = expired
} as const;

/**
 * Classify how fresh a data timestamp is relative to now.
 */
export function classifyFreshness(timestamp: Date | string): DataFreshness {
  const ageMs = Date.now() - new Date(timestamp).getTime();

  if (ageMs < FRESHNESS_THRESHOLDS.CURRENT_MS) return 'current';
  if (ageMs < FRESHNESS_THRESHOLDS.RECENT_MS) return 'recent';
  if (ageMs < FRESHNESS_THRESHOLDS.STALE_MS) return 'stale';
  return 'expired';
}

/** Returns true if data should be considered usable (not expired) */
export function isDataUsable(timestamp: Date | string): boolean {
  const freshness = classifyFreshness(timestamp);
  return freshness !== 'expired';
}

/** Returns a human-readable staleness notice for API consumers */
export function buildStalenessNotice(freshness: DataFreshness): string | null {
  switch (freshness) {
    case 'current':
      return null;
    case 'recent':
      return 'Data is from the past 24 hours.';
    case 'stale':
      return 'Data is over 24 hours old. Recommendations may not reflect current conditions.';
    case 'expired':
      return 'Data has expired and could not be refreshed. Recommendations are not available.';
  }
}
