/**
 * Axios API client with interceptors.
 *
 * - Attaches Authorization header on every request
 * - Automatically refreshes expired access tokens (once per failure)
 * - Redirects to /login on 401 after failed refresh
 * - Caches last known responses in sessionStorage for offline fallback
 * - All requests go through /api proxy in dev (configured in vite.config.ts)
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore.js';

const BASE_URL = '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor: attach access token ──────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: token refresh on 401 ───────────────────────────────

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeToRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function notifyRefreshSubscribers(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => {
    // Cache GET responses for offline use
    if (response.config.method === 'get' && response.config.url) {
      try {
        sessionStorage.setItem(
          `agrin_cache:${response.config.url}`,
          JSON.stringify({ data: response.data, cachedAt: Date.now() }),
        );
      } catch {
        // SessionStorage may be full — ignore
      }
    }
    return response;
  },
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Wait for the ongoing refresh to complete
        return new Promise((resolve) => {
          subscribeToRefresh((newToken) => {
            original.headers = {
              ...original.headers,
              Authorization: `Bearer ${newToken}`,
            };
            resolve(apiClient(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);
        notifyRefreshSubscribers(newAccessToken);

        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newAccessToken}`,
        };
        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/** Get cached response data for offline fallback */
export function getCachedResponse<T>(url: string): T | null {
  try {
    const raw = sessionStorage.getItem(`agrin_cache:${url}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: T; cachedAt: number };
    // Expire cache after 24 hours
    if (Date.now() - parsed.cachedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
