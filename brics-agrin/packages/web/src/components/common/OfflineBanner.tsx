import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-yellow-50 border-b border-yellow-300 text-yellow-800 text-sm px-4 py-2 flex items-center gap-2 fixed top-0 left-0 right-0 z-50"
    >
      <span aria-hidden="true">📶</span>
      <span>{t('common.offline')}</span>
    </div>
  );
}
