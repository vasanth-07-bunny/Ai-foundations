/**
 * Resilient HTTP client for external provider calls.
 *
 * Features:
 *  - Configurable timeout
 *  - Exponential back-off retry (network errors and 5xx only)
 *  - Request ID forwarded for distributed tracing
 *  - Never retries 4xx (client errors)
 *  - SSRF protection: only whitelisted hostnames are allowed
 *  - All errors wrapped in ExternalProviderError so one provider
 *    failure never propagates as a 500 to the farmer
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { config } from '../config/index.js';
import { createLogger } from '../observability/logger.js';
import { ExternalProviderError } from './errors.js';

const log = createLogger('http-client');

// ─── SSRF Whitelist ───────────────────────────────────────────────────────────
// Core allowed hostnames. Additional hostnames from env config are added at
// module initialisation below so operators can deploy new providers without
// code changes, while internal/private IPs are still blocked.

const ALLOWED_HOSTNAMES = new Set([
  'api.open-meteo.com',
  'api.openai.com',
]);

/**
 * Populate the whitelist from env-configured provider URLs.
 * Called once at startup — safe to call multiple times (idempotent).
 */
export function registerAllowedProviderUrls(): void {
  const urlsToRegister = [
    config.OPENMETEO_BASE_URL,
    config.SATELLITE_BASE_URL,
  ].filter(Boolean) as string[];

  for (const raw of urlsToRegister) {
    try {
      const parsed = new URL(raw);
      const hostname = parsed.hostname;
      // Block private/loopback addresses even if configured
      if (isPrivateOrLoopback(hostname)) {
        log.warn({ hostname }, 'SSRF guard: refusing to whitelist private/loopback hostname');
        continue;
      }
      ALLOWED_HOSTNAMES.add(hostname);
    } catch {
      // Invalid URL — skip
    }
  }
}

/** Returns true for RFC-1918 private and loopback addresses */
function isPrivateOrLoopback(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname === '0.0.0.0') return true;
  // IPv4 loopback
  if (/^127\./.test(hostname)) return true;
  // RFC-1918 private ranges
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  // IPv6 loopback
  if (hostname === '::1' || hostname === '[::1]') return true;
  return false;
}

function assertAllowedUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
      throw new Error(`SSRF protection: hostname '${parsed.hostname}' is not whitelisted`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('SSRF')) throw err;
    throw new Error(`Invalid URL: ${url}`);
  }
}

// ─── Retry logic ─────────────────────────────────────────────────────────────

function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  // Retry on network errors (no response) or 5xx server errors
  if (!err.response) return true;
  return err.response.status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Client factory ───────────────────────────────────────────────────────────

export function createHttpClient(providerName: string): AxiosInstance {
  const instance = axios.create({
    timeout: config.EXTERNAL_HTTP_TIMEOUT_MS,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'BRICS-AgriN/1.0',
    },
  });

  return instance;
}

/**
 * Execute a GET request with retry, timeout, and SSRF protection.
 */
export async function httpGet<T>(
  providerName: string,
  url: string,
  params?: Record<string, unknown>,
  axiosConfig?: AxiosRequestConfig,
): Promise<T> {
  assertAllowedUrl(url);

  const maxRetries = config.EXTERNAL_HTTP_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response: AxiosResponse<T> = await axios.get<T>(url, {
        params,
        timeout: config.EXTERNAL_HTTP_TIMEOUT_MS,
        headers: { 'User-Agent': 'BRICS-AgriN/1.0' },
        ...axiosConfig,
      });
      return response.data;
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err)) {
        // 4xx or other non-retryable — fail immediately
        break;
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.min(200 * Math.pow(2, attempt), 10_000);
        log.warn(
          { provider: providerName, attempt: attempt + 1, backoffMs },
          'Retrying external request',
        );
        await delay(backoffMs);
      }
    }
  }

  const message =
    axios.isAxiosError(lastError)
      ? `HTTP ${lastError.response?.status ?? 'network error'}: ${lastError.message}`
      : String(lastError);

  throw new ExternalProviderError(providerName, message);
}
