import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, FARM_CATEGORIES } from '@brics-agrin/shared';
import { profileApi } from '../api/index.js';
import { useAuthStore } from '../store/authStore.js';
import i18n from '../i18n/index.js';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English', hi: 'हिंदी', pt: 'Português', ru: 'Русский', zh: '中文', ar: 'العربية', fr: 'Français',
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [language, setLanguage] = useState(user?.language ?? 'en');
  const [farmCategory, setFarmCategory] = useState('small');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    profileApi.get()
      .then((res) => {
        setLanguage(res.data.data.language);
        setFarmCategory(res.data.data.farmCategory);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await profileApi.update({ language, farmCategory });
      // Update i18n language immediately
      i18n.changeLanguage(language);
      localStorage.setItem('agrin_language', language);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t('errors.server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl font-bold text-gray-900">{t('profile.title')}</h1>

      {user && (
        <div className="bg-agri-50 border border-agri-200 rounded-xl p-4">
          <p className="text-sm font-medium text-agri-800">{user.email}</p>
          <p className="text-xs text-agri-600 mt-0.5 capitalize">{user.role} · {user.country}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        {/* Language */}
        <div>
          <label htmlFor="prof-lang" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('profile.language')}
          </label>
          <select id="prof-lang" value={language} onChange={(e) => setLanguage(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l} value={l}>{LANGUAGE_LABELS[l] ?? l}</option>
            ))}
          </select>
        </div>

        {/* Farm category */}
        <div>
          <label htmlFor="prof-category" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('profile.farmCategory')}
          </label>
          <select id="prof-category" value={farmCategory} onChange={(e) => setFarmCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {FARM_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        {saved && (
          <p role="status" className="text-sm text-green-600">{t('profile.saved')} ✓</p>
        )}

        <button onClick={handleSave} disabled={loading}
          className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          aria-busy={loading}>
          {loading ? t('common.loading') : t('profile.save')}
        </button>
      </div>
    </div>
  );
}
