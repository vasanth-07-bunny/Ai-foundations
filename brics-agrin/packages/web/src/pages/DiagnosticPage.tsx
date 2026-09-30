import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CROP_GROWTH_STAGES } from '@brics-agrin/shared';
import { farmApi, diagnosticApi } from '../api/index.js';
import { ImageUploader } from '../components/diagnostic/ImageUploader.js';
import type { Farm } from '@brics-agrin/shared';

export default function DiagnosticPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [form, setForm] = useState({
    farmId: '',
    cropName: '',
    growthStage: 'vegetative',
    notes: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'uploading' | 'submitted'>('form');

  useEffect(() => {
    farmApi.list(1, 50).then((res) => {
      const list = res.data.data.data;
      setFarms(list);
      if (list.length > 0) setForm((f) => ({ ...f, farmId: list[0]!.id }));
    }).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) { setError('Please select an image first.'); return; }
    if (!form.farmId) { setError('Please select a farm.'); return; }
    if (!form.cropName.trim()) { setError('Please enter a crop name.'); return; }

    setStep('uploading');
    setUploading(true);
    try {
      // Step 1: upload image
      const uploadRes = await diagnosticApi.uploadImage(selectedFile);
      const { imageId } = uploadRes.data.data;

      // Step 2: submit diagnostic
      const diagRes = await diagnosticApi.submit({
        farmId: form.farmId,
        cropName: form.cropName.trim(),
        growthStage: form.growthStage,
        imageId,
        notes: form.notes.trim() || undefined,
      });

      navigate(`/diagnostics/${diagRes.data.data.id}`);
    } catch {
      setError(t('errors.server'));
      setStep('form');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl font-bold text-gray-900">{t('diagnostic.title')}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Image upload */}
        <section aria-label="Upload image">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">{t('diagnostic.upload')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('diagnostic.uploadHint')}</p>
          <ImageUploader onFileSelected={setSelectedFile} disabled={uploading} />
        </section>

        {/* Farm */}
        <div>
          <label htmlFor="diag-farm" className="block text-sm font-medium text-gray-700 mb-1">
            {t('diagnostic.selectFarm')}
          </label>
          <select id="diag-farm" value={form.farmId} onChange={(e) => set('farmId', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500" required>
            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* Crop name */}
        <div>
          <label htmlFor="diag-crop" className="block text-sm font-medium text-gray-700 mb-1">
            {t('diagnostic.selectCrop')}
          </label>
          <input id="diag-crop" type="text" value={form.cropName}
            onChange={(e) => set('cropName', e.target.value)}
            placeholder="e.g. wheat, rice, maize"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500"
            required />
        </div>

        {/* Growth stage */}
        <div>
          <label htmlFor="diag-stage" className="block text-sm font-medium text-gray-700 mb-1">
            {t('diagnostic.selectStage')}
          </label>
          <select id="diag-stage" value={form.growthStage} onChange={(e) => set('growthStage', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500">
            {CROP_GROWTH_STAGES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="diag-notes" className="block text-sm font-medium text-gray-700 mb-1">
            {t('diagnostic.notes')}
          </label>
          <textarea id="diag-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)}
            rows={3} maxLength={500}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-agri-500 resize-none"
            placeholder="Any additional observations..." />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {step === 'uploading' && (
          <div role="status" className="text-sm text-agri-600 bg-agri-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-agri-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            Uploading and submitting for analysis...
          </div>
        )}

        <button type="submit" disabled={uploading || !selectedFile}
          className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          aria-busy={uploading}>
          {uploading ? t('diagnostic.submitting') : t('diagnostic.submit')}
        </button>
      </form>
    </div>
  );
}
