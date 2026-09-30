/**
 * Auth store — Zustand.
 *
 * Persists tokens in localStorage with a key prefix.
 * NEVER stores the password.
 * Access token is kept in memory via the store, not localStorage,
 * to reduce XSS exposure window (only refreshToken persisted).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserPublic } from '@brics-agrin/shared';

interface AuthState {
  user: UserPublic | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (user: UserPublic, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'agrin_auth',
      // Only persist refreshToken + user — not the access token
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
