import React from 'react';
import { useTranslation } from 'react-i18next';

export function FullPageSpinner() {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      role="status"
      aria-label={t('common.loading')}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-agri-200 border-t-agri-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-500">{t('common.loading')}</span>
      </div>
    </div>
  );
}
