import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmApi } from '../api/index.js';
import type { Farm, Field } from '@brics-agrin/shared';

export default function FarmDetailPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [farm, setFarm] = useState<Farm | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId) return;
    Promise.all([
      farmApi.get(farmId),
      farmApi.listFields(farmId),
    ])
      .then(([farmRes, fieldsRes]) => {
        setFarm(farmRes.data.data);
        setFields(fieldsRes.data.data);
      })
      .catch(() => navigate('/farms'))
      .finally(() => setLoading(false));
  }, [farmId]);

  const handleDelete = async () => {
    if (!farmId || !window.confirm(t('farm.confirmDelete'))) return;
    await farmApi.delete(farmId);
    navigate('/farms');
  };

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
    </div>
  );

  if (!farm) return null;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Link to="/farms" className="text-sm text-gray-500 hover:text-gray-700">← {t('common.back')}</Link>
        <h1 className="text-xl font-bold text-gray-900 truncate">{farm.name}</h1>
      </div>

      {/* Farm details */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <DetailRow label="Area" value={`${farm.areaHectares} hectares`} />
        <DetailRow label="Country" value={farm.country} />
        <DetailRow label="Irrigation" value={farm.irrigationType.replace(/_/g, ' ')} />
        <DetailRow label="Practice" value={farm.farmingPractice.replace(/_/g, ' ')} />
        <DetailRow label="Category" value={farm.farmCategory.replace(/_/g, ' ')} />
      </section>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Link to="/advisory"
          className="flex-1 text-center bg-agri-50 hover:bg-agri-100 text-agri-700 font-medium text-sm py-2.5 rounded-lg transition-colors">
          💡 {t('dashboard.generateAdvisory')}
        </Link>
        <Link to="/diagnostics"
          className="flex-1 text-center bg-sky-50 hover:bg-sky-100 text-sky-700 font-medium text-sm py-2.5 rounded-lg transition-colors">
          🔬 {t('dashboard.diagnoseCrop')}
        </Link>
      </div>

      {/* Fields */}
      <section aria-label="Fields">
        <h2 className="font-semibold text-gray-900 mb-3">{t('farm.fields')}</h2>
        {fields.length === 0 ? (
          <p className="text-sm text-gray-500">{t('common.noData')}</p>
        ) : (
          <ul className="space-y-2">
            {fields.map((f) => (
              <li key={f.id} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="font-medium text-sm">{f.name}</p>
                <p className="text-xs text-gray-500">{f.areaHectares} ha</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section aria-label="Danger zone" className="border border-red-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-red-700 mb-2">⚠️ Danger Zone</h2>
        <button onClick={handleDelete}
          className="text-sm text-red-600 hover:text-red-800 underline">
          {t('farm.delete')}
        </button>
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 capitalize">{value}</span>
    </div>
  );
}
