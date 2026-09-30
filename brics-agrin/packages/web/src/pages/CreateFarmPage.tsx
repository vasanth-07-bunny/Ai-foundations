import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import {
  SUPPORTED_COUNTRIES, IRRIGATION_TYPES, FARMING_PRACTICES,
} from '@brics-agrin/shared';
import { farmApi } from '../api/index.js';

export default function CreateFarmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    lat: '',
    lon: '',
    areaHectares: '',
    country: 'IN',
    irrigationType: 'rainfed',
    farmingPractice: 'conventional',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(form.lat);
    const lon = parseFloat(form.lon);
    const area = parseFloat(form.areaHectares);

    if (isNaN(lat) || lat < -90 || lat > 90) { setError('Enter a valid latitude (-90 to 90)'); return; }
    if (isNaN(lon) || lon < -180 || lon > 180) { setError('Enter a valid longitude (-180 to 180)'); return; }
    if (isNaN(area) || area <= 0) { setError('Area must be a positive number'); return; }

    setLoading(true);
    try {
      const res = await farmApi.create({
        name: form.name.trim(),
        location: { lat, lon },
        areaHectares: area,
        country: form.country as never,
        irrigationType: form.irrigationType as never,
        farmingPractice: form.farmingPractice as never,
      });
      navigate(`/farms/${res.data.data.id}`);
    } catch {
      setError(t('errors.server'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Link to="/farms" className="text-sm text-gray-500 hover:text-gray-700">← {t('common.back')}</Link>
        <h1 className="text-xl font-bold text-gray-900">{t('farm.addFarm')}</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <Field label={t('farm.name')} id="cf-name">
          <input id="cf-name" type="text" required value={form.name} onChange={(e) => set('name', e.target.value)}
            className="input-field w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
            placeholder="e.g. North Field" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" id="cf-lat">
            <input id="cf-lat" type="number" step="0.0001" value={form.lat} onChange={(e) => set('lat', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
              placeholder="28.6139" />
          </Field>
          <Field label="Longitude" id="cf-lon">
            <input id="cf-lon" type="number" step="0.0001" value={form.lon} onChange={(e) => set('lon', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
              placeholder="77.2090" />
          </Field>
        </div>

        <Field label={`${t('farm.area')} (hectares)`} id="cf-area">
          <input id="cf-area" type="number" step="0.01" min="0.01" value={form.areaHectares}
            onChange={(e) => set('areaHectares', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
            placeholder="2.5" />
        </Field>

        <Field label={t('farm.country')} id="cf-country">
          <select id="cf-country" value={form.country} onChange={(e) => set('country', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {SUPPORTED_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label={t('farm.irrigation')} id="cf-irr">
          <select id="cf-irr" value={form.irrigationType} onChange={(e) => set('irrigationType', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {IRRIGATION_TYPES.map((i) => <option key={i} value={i}>{i.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>

        <Field label={t('farm.practice')} id="cf-prac">
          <select id="cf-prac" value={form.farmingPractice} onChange={(e) => set('farmingPractice', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {FARMING_PRACTICES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
          </select>
        </Field>

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-agri-600 hover:bg-agri-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          aria-busy={loading}>
          {loading ? t('farm.saving') : t('farm.save')}
        </button>
      </form>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
