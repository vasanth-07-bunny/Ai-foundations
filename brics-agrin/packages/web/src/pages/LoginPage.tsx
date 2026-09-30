import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginSchema } from '@brics-agrin/shared';
import { authApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = LoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(t('errors.validation'));
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { user, tokens } = res.data.data;
      login(user, tokens.accessToken, tokens.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        setError('Invalid email or password. Please check your details and try again.');
      } else if (status === 429) {
        setError('Too many login attempts. Please wait a few minutes before trying again.');
      } else {
        setError(t('errors.network'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-agri-50 to-gray-100 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="text-5xl" role="img" aria-label="Plant">🌿</span>
          <h1 className="text-2xl font-bold text-agri-800 mt-2">{t('app.name')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('app.tagline')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{t('auth.login')}</h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500 focus:border-agri-500"
                aria-describedby={error ? 'form-error' : undefined}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500 focus:border-agri-500"
              />
            </div>

            {error && (
              <p id="form-error" role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-agri-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={loading}
            >
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-4">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-agri-600 font-medium hover:underline">
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
