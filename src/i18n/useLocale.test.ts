import { afterEach, describe, expect, it } from 'vitest';
import { en, fr, translations, type Locale } from './locales';
import { translate, useLocale } from './useLocale';

describe('useLocale', () => {
  afterEach(() => {
    useLocale.getState().setMode('auto');
    localStorage.removeItem('geocarto-locale');
  });

  it('switches to French and updates the document language', () => {
    useLocale.getState().setMode('fr');

    expect(translate('settings.title')).toBe('Réglages');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('interpolates translated messages', () => {
    useLocale.getState().setMode('fr');

    expect(translate('toast.savedFile', { name: 'Paris.cartoproj' })).toBe(
      'Paris.cartoproj enregistré',
    );
  });

  it('keeps every locale catalog aligned to the English key set', () => {
    const englishKeys = Object.keys(en).sort();
    const localeEntries = Object.entries(translations) as [Locale, Record<string, string>][];

    for (const [locale, catalog] of localeEntries) {
      expect(Object.keys(catalog).sort(), locale).toEqual(englishKeys);
      expect(
        Object.entries(catalog).filter(([, value]) => typeof value !== 'string' || value.trim() === ''),
        locale,
      ).toEqual([]);
    }
  });

  it('keeps French placeholder names aligned with English', () => {
    const placeholderPattern = /\{(\w+)\}/g;
    const placeholders = (value: string) =>
      [...value.matchAll(placeholderPattern)].map((match) => match[1]).sort();

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });
});
