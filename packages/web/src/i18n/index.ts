import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE, getSavedLocale, setSavedLocale, type AppLocale } from '../lib/storage';
import en from './resources/en';
import zhCN from './resources/zh-CN';

export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'zh-CN'];

const resources = {
  en,
  'zh-CN': zhCN,
} as const;

function normalizeLocale(locale: string | null | undefined): AppLocale {
  if (locale === 'zh-CN') return 'zh-CN';
  return DEFAULT_LOCALE;
}

function syncHtmlLang(locale: AppLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
}

const initialLocale = normalizeLocale(getSavedLocale());

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLocale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

syncHtmlLang(initialLocale);

i18n.on('languageChanged', (locale) => {
  const normalized = normalizeLocale(locale);
  setSavedLocale(normalized);
  syncHtmlLang(normalized);
});

export function getCurrentLocale(): AppLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language);
}

export function setLocale(locale: AppLocale): Promise<void> {
  return i18n.changeLanguage(locale).then(() => undefined);
}

export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function formatTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(getCurrentLocale(), {
    timeStyle: 'medium',
  }).format(new Date(value));
}

export default i18n;
