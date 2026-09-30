import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { farmApi, advisoryApi } from '../api/index.js';
import { AdvisoryCard } from '../components/advisory/AdvisoryCard.js';
import type { Farm, Advisory } from '@brics-agrin/shared';

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [advisory, setAdvisory] = useState<Advisory | null>(null);
  const [loadingFarms, setLoadingFarms] = useState(true);

  useEffect(() => {
    farmApi.list(1, 5)
      .then((res) => setFarms(res.data.data.data))
      .catch(() => {/* handled by offline banner */})
      .finally(() => setLoadingFarms(false));
  }, []);

  const handleGenerate = async (farmId: string) => {
    try {
      const res = await advisoryApi.generate({ farmId, language: user?.language ?? 'en' });
      setAdvisory(res.data.data);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Welcome */}
      <section aria-label="Welcome">
        <h1 className="text-xl font-bold text-gray-900">
          {t('dashboard.welcome')}{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('dashboard.dataNotice')}</p>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3">
        <Link
          to="/advisory"
          className="flex flex-col items-center gap-2 bg-agri-600 hover:bg-agri-700 text-white rounded-xl p-4 transition-colors text-center"
        >
          <span className="text-2xl" aria-hidden="true">💡</span>
          <span className="text-sm font-medium">{t('dashboard.generateAdvisory')}</span>
        </Link>
        <Link
          to="/diagnostics"
          className="flex flex-col items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl p-4 transition-colors text-center"
        >
          <span className="text-2xl" aria-hidden="true">🔬</span>
          <span className="text-sm font-medium">{t('dashboard.diagnoseCrop')}</span>
        </Link>
      </section>

      {/* Farms overview */}
      <section aria-label="Your farms">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">{t('dashboard.yourFarms')}</h2>
          <Link to="/farms" className="text-sm text-agri-600 hover:underline">
            {t('farm.title')} →
          </Link>
        </div>

        {loadingFarms ? (
          <div className="text-sm text-gray-500 py-4 text-center" role="status">
            {t('common.loading')}
          </div>
        ) : farms.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500 mb-3">{t('dashboard.noFarms')}</p>
            <Link
              to="/farms"
              className="inline-flex items-center gap-1 bg-agri-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-agri-700 transition-colors"
            >
              + {t('dashboard.addFarm')}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {farms.map((farm) => (
              <li key={farm.id}>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{farm.name}</p>
                    <p className="text-xs text-gray-500">
                      {farm.areaHectares} ha · {farm.farmingPractice.replace('_', ' ')} · {farm.country}
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerate(farm.id)}
                    className="text-xs bg-agri-50 text-agri-700 hover:bg-agri-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    aria-label={`Generate advisory for ${farm.name}`}
                  >
                    Advisory
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Latest advisory */}
      {advisory && (
        <section aria-label="Latest advisory">
          <h2 className="font-semibold text-gray-900 mb-3">{t('dashboard.latestAdvisory')}</h2>
          <AdvisoryCard advisory={advisory} />
        </section>
      )}
    </div>
  );
}
