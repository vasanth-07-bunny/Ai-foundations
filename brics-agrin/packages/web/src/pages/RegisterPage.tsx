import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_COUNTRIES, SUPPORTED_LANGUAGES } from '@brics-agrin/shared';
import { authApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', pt: 'Português', ru: 'Русский', zh: '中文', ar: 'العربية', fr: 'Français',
};

const COUNTRY_LABELS: Record<string, string> = {
  IN: 'India', BR: 'Brazil', RU: 'Russia', CN: 'China', ZA: 'South Africa',
  ET: 'Ethiopia', EG: 'Egypt', IR: 'Iran', SA: 'Saudi Arabia', AE: 'UAE',
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [form, setForm] = useState({
    email: '', password: '', language: 'en', country: 'IN',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.email.includes('@')) errs.email = 'Enter a valid email address';
    if (form.password.length < 10) errs.password = 'Password must be at least 10 characters';
    if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number';
    if (!/[@$!%*?&]/.test(form.password)) errs.password = 'Password must contain a special character (@$!%*?&)';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    setLoading(true);
    try {
      const res = await authApi.register(form);
      const { user, tokens } = res.data.data;
      login(user, tokens.accessToken, tokens.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { error?: { message?: string } } } }).response?.status;
      if (status === 409) {
        setApiError('An account with this email already exists. Please sign in instead.');
      } else {
        setApiError(t('errors.network'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-agri-50 to-gray-100 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-5xl" role="img" aria-label="Plant">🌿</span>
          <h1 className="text-2xl font-bold text-agri-800 mt-2">{t('app.name')}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">{t('auth.register')}</h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field label={t('auth.email')} id="reg-email" error={errors.email}>
              <input id="reg-email" type="email" autoComplete="email" required
                value={form.email} onChange={(e) => set('email', e.target.value)}
                className="input-field" />
            </Field>

            <Field label={t('auth.password')} id="reg-password" error={errors.password}>
              <input id="reg-password" type="password" autoComplete="new-password" required
                value={form.password} onChange={(e) => set('password', e.target.value)}
                className="input-field" />
              <p className="text-xs text-gray-400 mt-1">
                Min 10 chars, include uppercase, number, and special character
              </p>
            </Field>

            <Field label={t('auth.language')} id="reg-lang">
              <select id="reg-lang" value={form.language} onChange={(e) => set('language', e.target.value)}
                className="input-field">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>
                ))}
              </select>
            </Field>

            <Field label={t('auth.country')} id="reg-country">
              <select id="reg-country" value={form.country} onChange={(e) => set('country', e.target.value)}
                className="input-field">
                {SUPPORTED_COUNTRIES.map((c) => (
                  <option key={c} value={c}>{COUNTRY_LABELS[c] ?? c}</option>
                ))}
              </select>
            </Field>

            {apiError && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{apiError}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              aria-busy={loading}>
              {loading ? t('auth.registering') : t('auth.registerButton')}
            </button>
          </form>

          <p className="text-sm text-center text-gray-500 mt-4">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-agri-600 font-medium hover:underline">{t('auth.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, error, children }: {
  label: string; id: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
