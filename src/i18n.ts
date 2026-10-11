import { createInstance } from 'i18next';
import en from './locales/en.ts';
import zhCN from './locales/zh-CN.ts';

export const languages = {
  'zh-CN': { name: '简体中文', translation: zhCN },
  en: { name: 'English', translation: en },
};
export type Locale = keyof typeof languages;
export type TranslationKey = keyof typeof en;
export const resources = Object.fromEntries(Object.entries(languages).map(([locale, { translation }]) => [locale, { translation }]));
export const i18n = createInstance();
void i18n.init({ resources, lng: 'zh-CN', fallbackLng: 'en', supportedLngs: Object.keys(languages), load: 'currentOnly', keySeparator: false, nsSeparator: false, initAsync: false, interpolation: { escapeValue: false } });

export function resolveLocale(value?: string): Locale {
  const normalized = value?.toLowerCase();
  const codes = Object.keys(languages) as Locale[];
  return codes.find(code => code.toLowerCase() === normalized)
    ?? codes.find(code => code.split('-')[0] === normalized?.split('-')[0])
    ?? 'en';
}
export const getLocale = () => resolveLocale(i18n.resolvedLanguage);
export const isTranslationKey = (value: unknown): value is TranslationKey => typeof value === 'string' && Object.hasOwn(en, value);

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Record<TranslationKey, string> };
    keySeparator: false;
    nsSeparator: false;
    strictKeyChecks: true;
    returnNull: false;
  }
}
