/**
 * Polls the diagnostic result until complete, then displays findings.
 *
 * Accessibility: status changes announced via aria-live,
 * confidence displayed as both text and a visual bar,
 * disclaimer shown prominently for all non-healthy results.
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { diagnosticApi } from '../api/index.js';
import { usePolling } from '../hooks/useApi.js';
import type { DiagnosticResult } from '@brics-agrin/shared';

const TERMINAL_STATUSES = ['completed', 'failed', 'low_confidence', 'inconclusive'];

const SEVERITY_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800 font-bold',
};

export default function DiagnosticResultPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const apiFn = useCallback(() => diagnosticApi.get(id!), [id]);
  const shouldStop = useCallback(
    (d: DiagnosticResult) => TERMINAL_STATUSES.includes(d.status),
    [],
  );

  const { data, error, polling, start } = usePolling<DiagnosticResult>(apiFn, shouldStop, 6000);

  useEffect(() => {
    // Initial fetch
    diagnosticApi.get(id!)
      .then((res) => {
        const d = res.data.data;
        setResult(d);
        if (!TERMINAL_STATUSES.includes(d.status)) {
          start();
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (data) setResult(data);
  }, [data]);

  const isTerminal = result && TERMINAL_STATUSES.includes(result.status);
  const confidencePct = result ? Math.round((result.confidence ?? 0) * 100) : 0;

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Link to="/diagnostics" className="text-sm text-gray-500 hover:text-gray-700">
          ← {t('common.back')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('diagnostic.title')}</h1>
      </div>

      {/* Processing indicator */}
      {(!isTerminal || polling) && (
        <div role="status" aria-live="polite"
          className="bg-sky-50 border border-sky-200 rounded-xl p-5 flex items-start gap-3">
          <span className="inline-block w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium text-sky-800 text-sm">{t(`diagnostic.status.${result?.status ?? 'pending'}`)}</p>
            <p className="text-xs text-sky-600 mt-1">{t('diagnostic.pollNote')}</p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Results */}
      {result && isTerminal && (
        <article className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
              ${result.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300'
                : result.status === 'failed' ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-yellow-100 text-yellow-800 border-yellow-300'}`}>
              {t(`diagnostic.status.${result.status}`)}
            </span>
            <span className="text-xs text-gray-500">
              {result.cropName} — {result.growthStage.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Disclaimer — prominent for all non-healthy results */}
          <div role="note" className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ {t('diagnostic.disclaimer')}</p>
            <p className="text-sm text-amber-700">{result.disclaimer}</p>
          </div>

          {/* Top condition */}
          {result.topCondition && (
            <section aria-label="Top diagnosis" className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-gray-900">{t('diagnostic.topCondition')}</h2>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 capitalize">
                  {result.topCondition.name.replace(/_/g, ' ')}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_BADGE[result.topCondition.severity.toLowerCase()] ?? ''}`}>
                  {result.topCondition.severity}
                </span>
              </div>
              <p className="text-sm text-gray-600">{result.topCondition.description}</p>
              {/* Confidence */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{t('diagnostic.confidence')}</span>
                  <span>{confidencePct}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={confidencePct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-2 rounded-full ${confidencePct >= 85 ? 'bg-green-500' : confidencePct >= 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                    style={{ width: `${confidencePct}%` }} />
                </div>
              </div>
            </section>
          )}

          {/* Other conditions */}
          {result.conditions.length > 1 && (
            <section aria-label="Other possible conditions">
              <h2 className="font-semibold text-gray-900 mb-2">{t('diagnostic.otherConditions')}</h2>
              <ul className="space-y-2">
                {result.conditions.slice(1).map((c) => (
                  <li key={c.name} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="text-sm capitalize">{c.name.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-500">{Math.round(c.confidence * 100)}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Safe next steps */}
          {result.safeNextSteps.length > 0 && (
            <section aria-label="Next steps">
              <h2 className="font-semibold text-gray-900 mb-2">{t('diagnostic.nextSteps')}</h2>
              <ol className="space-y-2">
                {result.safeNextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 bg-agri-100 text-agri-700 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Expert consultation banner */}
          {result.requiresExpertConsultation && (
            <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800">🩺 {t('diagnostic.requiresExpert')}</p>
              <p className="text-sm text-red-700 mt-1">{t('diagnostic.expertNote')}</p>
            </div>
          )}

          {/* Try again */}
          <Link to="/diagnostics"
            className="inline-block text-sm text-agri-600 hover:underline font-medium">
            ← {t('diagnostic.tryAgain')}
          </Link>
        </article>
      )}
    </div>
  );
}
