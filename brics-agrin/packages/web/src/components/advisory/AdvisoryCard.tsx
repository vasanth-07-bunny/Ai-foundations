/**
 * Advisory Card — displays a complete advisory with evidence provenance.
 *
 * Accessibility: uses semantic heading hierarchy, clear labels,
 * role=alert for critical risk levels, and high-contrast risk badges.
 *
 * Transparency: clearly labels data types (observed/predicted/AI-generated)
 * and shows data freshness warnings when data is stale.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Advisory } from '@brics-agrin/shared';

interface AdvisoryCardProps {
  advisory: Advisory;
}

const RISK_STYLES: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 border-green-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
};

const CATEGORY_ICONS: Record<string, string> = {
  IRRIGATION: '💧',
  FERTILIZATION: '🌱',
  PEST_MANAGEMENT: '🐛',
  DISEASE_MANAGEMENT: '🔬',
  HARVEST_TIMING: '🌾',
  SOIL_HEALTH: '🪱',
  CROP_ROTATION: '🔄',
  WEATHER_ALERT: '⚠️',
  REGENERATIVE_PRACTICE: '♻️',
  GENERAL: '📋',
};

export function AdvisoryCard({ advisory }: AdvisoryCardProps) {
  const { t } = useTranslation();
  const isCritical = advisory.riskLevel === 'CRITICAL';
  const confidencePct = Math.round(advisory.confidence * 100);
  const icon = CATEGORY_ICONS[advisory.category] ?? '📋';

  return (
    <article
      className={`rounded-xl border shadow-sm overflow-hidden ${isCritical ? 'border-red-400' : 'border-gray-200'}`}
      role={isCritical ? 'alert' : 'article'}
      aria-label={`${advisory.category} advisory`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${isCritical ? 'bg-red-50' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">{icon}</span>
          <h2 className="font-semibold text-gray-900 text-base capitalize">
            {advisory.category.replace(/_/g, ' ').toLowerCase()}
          </h2>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border ${RISK_STYLES[advisory.riskLevel] ?? RISK_STYLES.LOW}`}
          aria-label={`Risk level: ${advisory.riskLevel}`}
        >
          {t(`advisory.riskLevel.${advisory.riskLevel}`)}
        </span>
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-4 space-y-4 divide-y divide-gray-100">

        {/* Recommendation */}
        <section aria-labelledby="rec-heading">
          <h3 id="rec-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('advisory.recommendation')}
          </h3>
          <p className="text-gray-900 text-sm leading-relaxed">{advisory.recommendation}</p>
        </section>

        {/* Reason */}
        <section aria-labelledby="reason-heading" className="pt-3">
          <h3 id="reason-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('advisory.reason')}
          </h3>
          <p className="text-gray-700 text-sm leading-relaxed">{advisory.reason}</p>
        </section>

        {/* When to act */}
        <section aria-labelledby="timing-heading" className="pt-3">
          <h3 id="timing-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('advisory.actionTiming')}
          </h3>
          <p className="text-gray-700 text-sm">{advisory.actionTiming}</p>
        </section>

        {/* Environmental impact */}
        <section aria-labelledby="env-heading" className="pt-3">
          <h3 id="env-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('advisory.environmentalImpact')}
          </h3>
          <p className="text-gray-600 text-sm italic">{advisory.environmentalImpact}</p>
        </section>

        {/* Confidence + data evidence */}
        <section aria-labelledby="evidence-heading" className="pt-3">
          <h3 id="evidence-heading" className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('advisory.dataUsed')}
          </h3>
          <div className="space-y-1.5">
            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 flex-shrink-0">{t('advisory.confidence')}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2" role="progressbar" aria-valuenow={confidencePct} aria-valuemin={0} aria-valuemax={100} aria-label={`Confidence: ${confidencePct}%`}>
                <div
                  className={`h-2 rounded-full transition-all ${confidencePct >= 85 ? 'bg-green-500' : confidencePct >= 70 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-700 w-10 text-right">{confidencePct}%</span>
            </div>

            {/* Evidence breakdown */}
            {advisory.evidence.weather && (
              <EvidenceRow
                icon="🌤️"
                label={t('advisory.evidenceWeather')}
                summary={advisory.evidence.weather.summary}
                freshness={advisory.evidence.weather.freshness}
                dataType={advisory.evidence.weather.dataType}
              />
            )}
            {advisory.evidence.soil && (
              <EvidenceRow
                icon="🌍"
                label={t('advisory.evidenceSoil')}
                summary={advisory.evidence.soil.summary}
                freshness={advisory.evidence.soil.freshness}
                dataType={advisory.evidence.soil.dataType}
              />
            )}
            {advisory.evidence.satellite && (
              <EvidenceRow
                icon="🛰️"
                label={t('advisory.evidenceSatellite')}
                summary={advisory.evidence.satellite.summary}
                freshness={advisory.evidence.satellite.freshness}
                dataType={advisory.evidence.satellite.dataType}
              />
            )}
          </div>
        </section>

        {/* Metadata footer */}
        <footer className="pt-3 flex flex-wrap gap-3 text-xs text-gray-400">
          <span>Generated: {new Date(advisory.generatedAt).toLocaleString()}</span>
          <span>Model: {advisory.modelVersion}</span>
        </footer>
      </div>
    </article>
  );
}

function EvidenceRow({
  icon, label, summary, freshness, dataType,
}: {
  icon: string;
  label: string;
  summary: string;
  freshness: string;
  dataType: string;
}) {
  const { t } = useTranslation();
  const freshnessStyle =
    freshness === 'current' ? 'text-green-600' :
    freshness === 'recent' ? 'text-yellow-600' :
    'text-orange-600';

  return (
    <div className="flex items-start gap-2 text-xs">
      <span aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-700">{label}: </span>
        <span className="text-gray-600">{summary}</span>
      </div>
      <span className={`flex-shrink-0 ${freshnessStyle}`}>
        {t(`common.freshness.${freshness}`)}
        {' · '}
        {t(`advisory.dataType.${dataType}`)}
      </span>
    </div>
  );
}
