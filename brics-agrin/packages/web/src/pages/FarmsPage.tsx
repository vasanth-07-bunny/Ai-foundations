import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { farmApi } from '../api/index.js';
import type { Farm } from '@brics-agrin/shared';

export default function FarmsPage() {
  const { t } = useTranslation();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFarms = () => {
    setLoading(true);
    farmApi.list(1, 50)
      .then((res) => setFarms(res.data.data.data))
      .catch(() => setError(t('errors.network')))
      .finally(() => setLoading(false));
  };

  useEffect(loadFarms, []);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t('farm.title')}</h1>
        <Link to="/farms/new"
          className="bg-agri-600 hover:bg-agri-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + {t('farm.addFarm')}
        </Link>
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : farms.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <span className="text-4xl" aria-hidden="true">🌾</span>
          <p className="text-sm text-gray-500 mt-3 mb-4">{t('dashboard.noFarms')}</p>
          <Link to="/farms/new"
            className="inline-block bg-agri-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-agri-700 transition-colors">
            {t('dashboard.addFarm')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" role="list">
          {farms.map((farm) => (
            <li key={farm.id}>
              <Link to={`/farms/${farm.id}`}
                className="block bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-agri-300 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{farm.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      <Tag>{farm.areaHectares} ha</Tag>
                      <Tag>{farm.country}</Tag>
                      <Tag>{farm.farmingPractice.replace('_', ' ')}</Tag>
                      <Tag>{farm.irrigationType.replace('_', ' ')}</Tag>
                    </div>
                  </div>
                  <span className="text-gray-400 flex-shrink-0 mt-1">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">
      {children}
    </span>
  );
}
