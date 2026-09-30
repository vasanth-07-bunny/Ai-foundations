import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore.js';
import { farmApi, advisoryApi } from '../api/index.js';
import { AdvisoryCard } from '../components/advisory/AdvisoryCard.js';
import type { Farm, Advisory } from '@brics-agrin/shared';

export default function AdvisoryPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [advisory, setAdvisory] = useState<Advisory | null | undefined>(undefined); // undefined = not yet tried
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    farmApi.list(1, 50)
      .then((res) => {
        const list = res.data.data.data;
        setFarms(list);
        if (list.length > 0) setSelectedFarmId(list[0]!.id);
      })
      .catch(() => setError(t('errors.network')));
  }, []);

  const handleGenerate = async () => {
    if (!selectedFarmId) return;
    setLoading(true);
    setError(null);
    setAdvisory(undefined);
    try {
      const res = await advisoryApi.generate({
        farmId: selectedFarmId,
        language: user?.language ?? 'en',
      });
      setAdvisory(res.data.data);
    } catch {
      setError(t('errors.server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl font-bold text-gray-900">{t('advisory.title')}</h1>

      {/* Farm selector */}
      <section aria-label="Generate advisory">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          {farms.length > 0 ? (
            <>
              <div>
                <label htmlFor="farm-select" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('advisory.selectFarm')}
                </label>
                <select
                  id="farm-select"
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.areaHectares} ha
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !selectedFarmId}
                className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
                aria-busy={loading}
              >
                {loading ? t('advisory.generating') : t('advisory.generate')}
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">{t('dashboard.noFarms')}</p>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3" aria-label={t('common.loading')} role="status">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Result */}
      {advisory === null && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
          <span className="text-3xl" aria-hidden="true">🌤️</span>
          <p className="text-sm text-gray-600 mt-2">{t('advisory.noAdvisory')}</p>
        </div>
      )}

      {advisory && <AdvisoryCard advisory={advisory} />}
    </div>
  );
}
