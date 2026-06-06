import { afterEach, describe, expect, it } from 'vitest';
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
});
