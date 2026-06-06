import { create } from 'zustand';
import {
  translations,
  type Locale,
  type LocaleMode,
  type TranslationKey,
  type TranslationParams,
} from './locales';

const STORAGE_KEY = 'geocarto-locale';

function safeRead(): LocaleMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'en' || value === 'fr' || value === 'auto' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

function safeWrite(value: LocaleMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* sandboxed browsers throw on localStorage */
  }
}

function browserLocale(): Locale {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith('fr')) ? 'fr' : 'en';
}

function resolvedLocale(mode: LocaleMode): Locale {
  return mode === 'auto' ? browserLocale() : mode;
}

function applyDocumentLanguage(locale: Locale): void {
  document.documentElement.lang = locale;
}

function formatMessage(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

interface LocaleState {
  mode: LocaleMode;
  locale: Locale;
  setMode: (mode: LocaleMode) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const initialMode = safeRead();
const initialLocale = resolvedLocale(initialMode);
applyDocumentLanguage(initialLocale);

export const useLocale = create<LocaleState>((set, get) => ({
  mode: initialMode,
  locale: initialLocale,
  setMode: (mode) => {
    const locale = resolvedLocale(mode);
    safeWrite(mode);
    applyDocumentLanguage(locale);
    set({ mode, locale });
  },
  t: (key, params) => formatMessage(translations[get().locale][key], params),
}));

export function translate(key: TranslationKey, params?: TranslationParams): string {
  return useLocale.getState().t(key, params);
}

export function localeNumber(value: number): string {
  return value.toLocaleString(useLocale.getState().locale === 'fr' ? 'fr-FR' : 'en-US');
}
