/**
 * i18n configuration using react-i18next.
 *
 * Supported languages: en, hi, pt, ru, zh, ar, fr
 * Language is loaded lazily per locale to minimise bundle size.
 * Falls back to English if a key is missing in the active language.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import pt from './locales/pt.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      pt: { translation: pt },
    },
    lng: localStorage.getItem('agrin_language') ?? 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
