import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_VERSION,
  migratePreferences,
} from './preferencesStore';

describe('migratePreferences', () => {
  it('returns the full default set for empty / null input', () => {
    expect(migratePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(migratePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps valid fields and defaults the rest (partial older blob)', () => {
    const migrated = migratePreferences({ unitSystem: 'imperial', accent: 'green' });
    expect(migrated.unitSystem).toBe('imperial');
    expect(migrated.accent).toBe('green');
    // Untouched fields fall back to defaults.
    expect(migrated.autosaveIntervalSec).toBe(DEFAULT_PREFERENCES.autosaveIntervalSec);
    expect(migrated.defaultBasemap).toBe(DEFAULT_PREFERENCES.defaultBasemap);
    // Always re-stamped to the current schema version.
    expect(migrated.version).toBe(PREFERENCES_VERSION);
  });

  it('rejects out-of-range and unknown enum values', () => {
    const migrated = migratePreferences({
      unitSystem: 'furlongs',
      accent: 'chartreuse',
      defaultBasemap: 'satellite',
      autosaveIntervalSec: 9999,
      gridSpacingDefault: -5,
      gridSnapDefault: 'yes',
    });
    expect(migrated.unitSystem).toBe(DEFAULT_PREFERENCES.unitSystem);
    expect(migrated.accent).toBe(DEFAULT_PREFERENCES.accent);
    expect(migrated.defaultBasemap).toBe(DEFAULT_PREFERENCES.defaultBasemap);
    expect(migrated.autosaveIntervalSec).toBe(120); // clamped to max
    expect(migrated.gridSpacingDefault).toBe(4); // clamped to min
    expect(migrated.gridSnapDefault).toBe(DEFAULT_PREFERENCES.gridSnapDefault);
  });

  it('clamps numeric fields into their valid ranges', () => {
    expect(migratePreferences({ autosaveIntervalSec: 1 }).autosaveIntervalSec).toBe(2);
    expect(migratePreferences({ gridSpacingDefault: 5000 }).gridSpacingDefault).toBe(200);
  });
});

describe('usePreferencesStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a changed preference and resets back to defaults', async () => {
    const { usePreferencesStore } = await import('./preferencesStore');
    usePreferencesStore.getState().setPreference('unitSystem', 'imperial');
    expect(usePreferencesStore.getState().unitSystem).toBe('imperial');
    expect(JSON.parse(localStorage.getItem('geocarto-preferences')!).unitSystem).toBe('imperial');

    usePreferencesStore.getState().resetPreferences();
    expect(usePreferencesStore.getState().unitSystem).toBe(DEFAULT_PREFERENCES.unitSystem);
    expect(JSON.parse(localStorage.getItem('geocarto-preferences')!).accent).toBe(
      DEFAULT_PREFERENCES.accent,
    );
  });
});
