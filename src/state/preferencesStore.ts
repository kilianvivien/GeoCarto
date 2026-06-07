import { create } from 'zustand';
import type { BuiltInBasemapPreset, MeasurementUnitSystem } from '@/project/cartoproj';

/**
 * App-level preferences (M21). These persist to `localStorage` and are distinct
 * from per-project `.cartoproj` settings — they describe how *this install*
 * behaves, not what a given document contains.
 *
 * Theme and locale deliberately stay in their own stores (`useTheme`,
 * `useLocale`): both already persist and theme has a pre-paint bootstrap in
 * index.html. "One source of truth" means each setting is owned exactly once,
 * not that every store collapses into this one.
 */
export type AccentKey = 'blue' | 'purple' | 'green' | 'orange' | 'pink';

export interface Preferences {
  /** Schema version for forward-compatible defaulting/migration. */
  version: number;
  /** Default unit system seeded into new measurement / scale-bar annotations. */
  unitSystem: MeasurementUnitSystem;
  /** Autosave debounce, in seconds. */
  autosaveIntervalSec: number;
  /** Built-in basemap preset applied to freshly created projects. */
  defaultBasemap: BuiltInBasemapPreset;
  /** Canvas-aid defaults seeded into the tool store at app start. */
  gridSnapDefault: boolean;
  smartGuidesDefault: boolean;
  gridSpacingDefault: number;
  /** Accent colour preset. */
  accent: AccentKey;
}

export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: Preferences = {
  version: PREFERENCES_VERSION,
  unitSystem: 'metric',
  autosaveIntervalSec: 10,
  defaultBasemap: 'editorial-light',
  gridSnapDefault: false,
  smartGuidesDefault: true,
  gridSpacingDefault: 20,
  accent: 'blue',
};

const STORAGE_KEY = 'geocarto-preferences';

const UNIT_SYSTEMS: MeasurementUnitSystem[] = ['metric', 'imperial'];
const BASEMAP_PRESETS: BuiltInBasemapPreset[] = [
  'editorial-light',
  'editorial-dark',
  'minimal-grey',
  'print-bw',
];
const ACCENTS: AccentKey[] = ['blue', 'purple', 'green', 'orange', 'pink'];

/**
 * Coerce arbitrary stored JSON into a valid `Preferences`, falling back to the
 * default for any missing or malformed field. This doubles as the migration
 * path: an older blob simply keeps the fields it has and gains defaults for the
 * rest, then is re-stamped to the current version.
 */
export function migratePreferences(raw: unknown): Preferences {
  const value = (raw ?? {}) as Partial<Preferences>;
  const clampSpacing = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(4, Math.min(200, n)) : undefined;
  const clampInterval = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(2, Math.min(120, n)) : undefined;
  return {
    version: PREFERENCES_VERSION,
    unitSystem: UNIT_SYSTEMS.includes(value.unitSystem as MeasurementUnitSystem)
      ? (value.unitSystem as MeasurementUnitSystem)
      : DEFAULT_PREFERENCES.unitSystem,
    autosaveIntervalSec: clampInterval(value.autosaveIntervalSec) ?? DEFAULT_PREFERENCES.autosaveIntervalSec,
    defaultBasemap: BASEMAP_PRESETS.includes(value.defaultBasemap as BuiltInBasemapPreset)
      ? (value.defaultBasemap as BuiltInBasemapPreset)
      : DEFAULT_PREFERENCES.defaultBasemap,
    gridSnapDefault:
      typeof value.gridSnapDefault === 'boolean'
        ? value.gridSnapDefault
        : DEFAULT_PREFERENCES.gridSnapDefault,
    smartGuidesDefault:
      typeof value.smartGuidesDefault === 'boolean'
        ? value.smartGuidesDefault
        : DEFAULT_PREFERENCES.smartGuidesDefault,
    gridSpacingDefault: clampSpacing(value.gridSpacingDefault) ?? DEFAULT_PREFERENCES.gridSpacingDefault,
    accent: ACCENTS.includes(value.accent as AccentKey)
      ? (value.accent as AccentKey)
      : DEFAULT_PREFERENCES.accent,
  };
}

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return migratePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function writePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* sandboxed browsers throw on localStorage — preferences degrade to session-only */
  }
}

/** Pick just the persisted preference fields off the store state. */
function snapshot(state: Preferences): Preferences {
  return {
    version: state.version,
    unitSystem: state.unitSystem,
    autosaveIntervalSec: state.autosaveIntervalSec,
    defaultBasemap: state.defaultBasemap,
    gridSnapDefault: state.gridSnapDefault,
    smartGuidesDefault: state.smartGuidesDefault,
    gridSpacingDefault: state.gridSpacingDefault,
    accent: state.accent,
  };
}

interface PreferencesState extends Preferences {
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  resetPreferences: () => void;
}

const initial = readPreferences();

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...initial,
  setPreference: (key, value) => {
    set({ [key]: value } as Pick<Preferences, typeof key>);
    writePreferences(snapshot(get()));
  },
  resetPreferences: () => {
    set({ ...DEFAULT_PREFERENCES });
    writePreferences({ ...DEFAULT_PREFERENCES });
  },
}));

/** Non-reactive read of the autosave debounce, in ms. */
export function autosaveIntervalMs(): number {
  return usePreferencesStore.getState().autosaveIntervalSec * 1000;
}

/** Non-reactive read of the default unit system for new annotations. */
export function defaultUnitSystem(): MeasurementUnitSystem {
  return usePreferencesStore.getState().unitSystem;
}

/** Non-reactive read of the basemap preset for freshly created projects. */
export function defaultBasemapPreset(): BuiltInBasemapPreset {
  return usePreferencesStore.getState().defaultBasemap;
}
