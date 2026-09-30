/**
 * Generic hook for async API calls.
 *
 * - Tracks loading/error/data state
 * - Returns a typed execute function
 * - Supports offline fallback via cached responses
 */

import { useState, useCallback } from 'react';
import axios from 'axios';
import { getCachedResponse } from '../api/client.js';
import i18n from '../i18n/index.js';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (
      apiFn: () => Promise<{ data: { data: T } }>,
      cacheKey?: string,
    ): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const res = await apiFn();
        const data = res.data.data;
        setState({ data, loading: false, error: null });
        return data;
      } catch (err: unknown) {
        // Try offline cache fallback
        if (cacheKey && !navigator.onLine) {
          const cached = getCachedResponse<{ data: T }>(cacheKey);
          if (cached) {
            const data = cached.data;
            setState({ data, loading: false, error: null });
            return data;
          }
        }

        const status = axios.isAxiosError(err) ? err.response?.status : null;
        let message = i18n.t('errors.network');
        if (status === 401) message = i18n.t('errors.unauthorized');
        else if (status === 403) message = i18n.t('errors.forbidden');
        else if (status === 404) message = i18n.t('errors.notFound');
        else if (status && status >= 500) message = i18n.t('errors.server');

        setState({ data: null, loading: false, error: message });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() =>
    setState({ data: null, loading: false, error: null }), []);

  return { ...state, execute, reset };
}

/**
 * Hook that polls an API endpoint until a condition is met.
 * Used by DiagnosticResultPage to poll pending results.
 */
export function usePolling<T>(
  apiFn: () => Promise<{ data: { data: T } }>,
  shouldStop: (data: T) => boolean,
  intervalMs = 5000,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const start = useCallback(() => {
    setPolling(true);
    const id = setInterval(async () => {
      try {
        const res = await apiFn();
        const d = res.data.data;
        setData(d);
        if (shouldStop(d)) {
          clearInterval(id);
          setPolling(false);
        }
      } catch {
        setError(i18n.t('errors.network'));
        clearInterval(id);
        setPolling(false);
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [apiFn, shouldStop, intervalMs]);

  return { data, error, polling, start };
}
