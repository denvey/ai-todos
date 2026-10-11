import { i18n, getLocale, languages, resolveLocale, isTranslationKey } from '../src/i18n.ts';
import type { Locale } from '../src/i18n.ts';
import { enUS, zhCN } from 'react-day-picker/locale';
export const calendarLocales = { en: enUS, 'zh-CN': zhCN } satisfies Record<Locale, typeof enUS>;
export { i18n, getLocale, languages };
export function localizedError(payload: unknown): string {
  const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  if (isTranslationKey(value.code)) return i18n.t(value.code, value.params && typeof value.params === 'object' ? value.params as Record<string, unknown> : {});
  if (value.messages && typeof value.messages === 'object') {
    const message = (value.messages as Record<string, unknown>)[getLocale()];
    if (typeof message === 'string') return message;
  }
  return typeof value.error === 'string' ? value.error : i18n.t('connection.toolFailed');
}

export type LanguagePreference = 'auto' | Locale;
const storageKey = 'ai-todos.language';
let preference: LanguagePreference = 'auto';
let hostLocale: string | undefined;
const validPreference = (value: string | null): LanguagePreference => value && Object.hasOwn(languages, value) ? value as Locale : 'auto';
export const getLanguagePreference = () => preference;
function applyLanguage() {
  void i18n.changeLanguage(preference === 'auto' ? resolveLocale(hostLocale || (typeof navigator !== 'undefined' ? navigator.language : undefined)) : preference);
}
export function applyHostLocale(locale?: string) { hostLocale = locale; applyLanguage(); }
export function setLanguagePreference(value: LanguagePreference): boolean {
  preference = validPreference(value);
  let saved = true;
  try { window.localStorage.setItem(storageKey, preference); } catch { saved = false; }
  applyLanguage();
  return saved;
}
if (typeof window !== 'undefined') {
  try { preference = validPreference(window.localStorage.getItem(storageKey)); } catch {}
  const updateDocument = () => { document.documentElement.lang = getLocale(); document.title = i18n.t('app.title'); };
  i18n.on('languageChanged', updateDocument);
  applyLanguage();
  updateDocument();
  window.addEventListener('languagechange', () => { if (preference === 'auto') applyLanguage(); });
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) { preference = validPreference(event.newValue); applyLanguage(); }
  });
}
