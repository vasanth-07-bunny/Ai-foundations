/**
 * Lightweight in-process metrics.
 *
 * In production these would be exported to Prometheus/CloudWatch.
 * For now we track key counters and gauges in memory with a simple
 * interface that can be swapped for a real metrics client without
 * changing any call sites.
 */

interface Counter {
  increment(labels?: Record<string, string>): void;
  value(labels?: Record<string, string>): number;
}

interface Histogram {
  observe(valueMs: number, labels?: Record<string, string>): void;
  summary(): Record<string, number>;
}

class SimpleCounter implements Counter {
  private counts = new Map<string, number>();

  increment(labels: Record<string, string> = {}): void {
    const key = JSON.stringify(labels);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  value(labels: Record<string, string> = {}): number {
    return this.counts.get(JSON.stringify(labels)) ?? 0;
  }
}

class SimpleHistogram implements Histogram {
  private observations: number[] = [];

  observe(valueMs: number): void {
    this.observations.push(valueMs);
    // Cap memory usage — keep only the last 1000 observations
    if (this.observations.length > 1000) this.observations.shift();
  }

  summary(): Record<string, number> {
    if (this.observations.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    }
    const sorted = [...this.observations].sort((a, b) => a - b);
    const n = sorted.length;
    const p = (pct: number) => sorted[Math.floor(n * pct)] ?? 0;
    return {
      count: n,
      p50: p(0.5),
      p95: p(0.95),
      p99: p(0.99),
      max: sorted[n - 1] ?? 0,
    };
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const metrics = {
  httpRequests: new SimpleCounter(),
  httpErrors: new SimpleCounter(),
  advisoryGenerated: new SimpleCounter(),
  advisoryCacheHit: new SimpleCounter(),
  diagnosticRequested: new SimpleCounter(),
  externalProviderError: new SimpleCounter(),
  authAttempts: new SimpleCounter(),
  authFailures: new SimpleCounter(),

  advisoryLatency: new SimpleHistogram(),
  diagnosticLatency: new SimpleHistogram(),
  weatherProviderLatency: new SimpleHistogram(),
  satelliteProviderLatency: new SimpleHistogram(),
} as const;

/** Serialise all current metric values — used by /health/metrics endpoint */
export function getMetricsSummary(): Record<string, unknown> {
  return {
    counters: {
      httpRequests: metrics.httpRequests.value(),
      httpErrors: metrics.httpErrors.value(),
      advisoryGenerated: metrics.advisoryGenerated.value(),
      advisoryCacheHit: metrics.advisoryCacheHit.value(),
      diagnosticRequested: metrics.diagnosticRequested.value(),
      externalProviderErrors: metrics.externalProviderError.value(),
      authAttempts: metrics.authAttempts.value(),
      authFailures: metrics.authFailures.value(),
    },
    latencyMs: {
      advisory: metrics.advisoryLatency.summary(),
      diagnostic: metrics.diagnosticLatency.summary(),
      weatherProvider: metrics.weatherProviderLatency.summary(),
      satelliteProvider: metrics.satelliteProviderLatency.summary(),
    },
  };
}
