import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Globe,
  Palette,
  SquarePen,
  Save,
  Map as MapIcon,
  RefreshCw,
  RotateCcw,
  X,
  type LucideIcon,
} from 'lucide-react';
import { LOCALE_OPTIONS, type LocaleMode, type TranslationKey } from '@/i18n/locales';
import { localeNumber, useLocale } from '@/i18n/useLocale';
import { useToolStore } from '@/state/toolStore';
import {
  DEFAULT_PREFERENCES,
  usePreferencesStore,
  type AccentKey,
} from '@/state/preferencesStore';
import type { BuiltInBasemapPreset, MeasurementUnitSystem } from '@/project/cartoproj';
import { ACCENT_SWATCH } from './accent';
import { useTheme, type Theme } from './useTheme';
import { useModalFocusTrap } from './useModalFocusTrap';
import { useStorageHealth } from '@/project/storageHealth';

const TRANSITION_MS = 220;

type TabId = 'general' | 'appearance' | 'editor' | 'autosave' | 'basemap';

const TABS: { id: TabId; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: 'general', labelKey: 'settings.general', icon: Globe },
  { id: 'appearance', labelKey: 'settings.appearance', icon: Palette },
  { id: 'editor', labelKey: 'settings.tabEditor', icon: SquarePen },
  { id: 'autosave', labelKey: 'settings.tabAutosave', icon: Save },
  { id: 'basemap', labelKey: 'settings.tabBasemap', icon: MapIcon },
];

const ACCENT_OPTIONS: { value: AccentKey; labelKey: TranslationKey }[] = [
  { value: 'blue', labelKey: 'settings.accentBlue' },
  { value: 'purple', labelKey: 'settings.accentPurple' },
  { value: 'green', labelKey: 'settings.accentGreen' },
  { value: 'orange', labelKey: 'settings.accentOrange' },
  { value: 'pink', labelKey: 'settings.accentPink' },
];

const BASEMAP_OPTIONS: { value: BuiltInBasemapPreset; labelKey: TranslationKey }[] = [
  { value: 'editorial-light', labelKey: 'basemap.editorialLight' },
  { value: 'editorial-dark', labelKey: 'basemap.editorialDark' },
  { value: 'minimal-grey', labelKey: 'basemap.minimalGrey' },
  { value: 'print-bw', labelKey: 'basemap.printBw' },
];

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[12.5px] text-[var(--text-2)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--accent)]"
      />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 text-[12.5px] text-[var(--text-2)]">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-[var(--text-3)]">{children}</p>;
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-full gap-1 rounded-full border border-[var(--divider)] bg-[var(--hover)] p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
              active
                ? 'bg-[var(--accent)] text-[var(--text-on-accent)]'
                : 'text-[var(--text-2)] hover:text-[var(--text)]'
            }`}
          >
            {active && <Check size={12} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FieldGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          {title}
        </div>
      )}
      {children}
    </section>
  );
}

function formatBytes(value: number | null): string {
  if (value == null) return '—';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / (1024 * 1024))} MB`;
  return `${Math.round((value / (1024 * 1024 * 1024)) * 10) / 10} GB`;
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<TabId>('general');
  const dialogRef = useRef<HTMLDivElement>(null);
  const t = useLocale((s) => s.t);
  const localeMode = useLocale((s) => s.mode);
  const setLocaleMode = useLocale((s) => s.setMode);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  // Live canvas-aid state (status bar shares these). Settings edits the persisted
  // *default* and also applies it live so the change is immediately visible.
  const gridSnapEnabled = useToolStore((s) => s.gridSnapEnabled);
  const gridSpacing = useToolStore((s) => s.gridSpacing);
  const smartGuidesEnabled = useToolStore((s) => s.smartGuidesEnabled);
  const { setGridSnapEnabled, setGridSpacing, setSmartGuidesEnabled } = useToolStore.getState();

  const accent = usePreferencesStore((s) => s.accent);
  const onlineSearchEnabled = usePreferencesStore((s) => s.onlineSearchEnabled);
  const unitSystem = usePreferencesStore((s) => s.unitSystem);
  const autosaveIntervalSec = usePreferencesStore((s) => s.autosaveIntervalSec);
  const defaultBasemap = usePreferencesStore((s) => s.defaultBasemap);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const resetPreferences = usePreferencesStore((s) => s.resetPreferences);
  const storage = useStorageHealth();
  useModalFocusTrap(open, dialogRef, onClose);

  const setGridSnap = (next: boolean) => {
    setPreference('gridSnapDefault', next);
    setGridSnapEnabled(next);
  };
  const setSmartGuides = (next: boolean) => {
    setPreference('smartGuidesDefault', next);
    setSmartGuidesEnabled(next);
  };
  const setSpacing = (next: number) => {
    const clamped = Math.max(4, Math.min(200, next));
    setPreference('gridSpacingDefault', clamped);
    setGridSpacing(clamped);
  };

  const resetAll = () => {
    resetPreferences();
    setGridSnapEnabled(DEFAULT_PREFERENCES.gridSnapDefault);
    setSmartGuidesEnabled(DEFAULT_PREFERENCES.smartGuidesDefault);
    setGridSpacing(DEFAULT_PREFERENCES.gridSpacingDefault);
  };

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void useStorageHealth.getState().refresh();
  }, [open]);

  if (!mounted) return null;

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ];

  const unitOptions: { value: MeasurementUnitSystem; label: string }[] = [
    { value: 'metric', label: t('settings.unitsMetric') },
    { value: 'imperial', label: t('settings.unitsImperial') },
  ];

  const localeOptions = LOCALE_OPTIONS.map((option) => ({
    value: option.value,
    label:
      option.value === 'auto'
        ? t('settings.languageAutomatic')
        : option.value === 'fr'
          ? t('settings.languageFrench')
          : t('settings.languageEnglish'),
  }));

  const selectClass =
    'min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('settings.title')}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`glass flex h-[440px] w-[680px] max-w-[94vw] flex-col overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-modal)] text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--divider)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold">{t('settings.title')}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">{t('settings.subtitle')}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('settings.close')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav
            role="tablist"
            aria-orientation="vertical"
            className="flex w-[168px] shrink-0 flex-col gap-0.5 border-r border-[var(--divider)] p-2.5"
          >
            {TABS.map(({ id, labelKey, icon: TabIcon }) => {
              const active = id === tab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`settings-panel-${id}`}
                  id={`settings-tab-${id}`}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
                  }`}
                >
                  <TabIcon size={15} />
                  {t(labelKey)}
                </button>
              );
            })}
          </nav>

          <div
            role="tabpanel"
            id={`settings-panel-${tab}`}
            aria-labelledby={`settings-tab-${tab}`}
            className="flex-1 overflow-y-auto p-5"
          >
            {tab === 'general' && (
              <FieldGroup>
                <Field label={t('settings.language')}>
                  <select
                    aria-label={t('settings.language')}
                    value={localeMode}
                    onChange={(event) => setLocaleMode(event.target.value as LocaleMode)}
                    className={selectClass}
                  >
                    {localeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Hint>{t('settings.languageHelp')}</Hint>
                <ToggleRow
                  label={t('settings.onlineSearch')}
                  checked={onlineSearchEnabled}
                  onChange={(checked) => setPreference('onlineSearchEnabled', checked)}
                />
                <Hint>{t('settings.onlineSearchHelp')}</Hint>
              </FieldGroup>
            )}

            {tab === 'appearance' && (
              <div className="flex flex-col gap-6">
                <FieldGroup>
                  <Field label={t('settings.theme')}>
                    <Segmented value={theme} options={themeOptions} onChange={setTheme} />
                  </Field>
                  <Field label={t('settings.accent')}>
                    <div className="flex gap-2">
                      {ACCENT_OPTIONS.map((option) => {
                        const active = option.value === accent;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-label={t(option.labelKey)}
                            aria-pressed={active}
                            onClick={() => setPreference('accent', option.value)}
                            className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                              active
                                ? 'ring-2 ring-[var(--accent-ring)] ring-offset-2 ring-offset-[var(--surface-modal)]'
                                : ''
                            }`}
                            style={{ background: ACCENT_SWATCH[option.value] }}
                          />
                        );
                      })}
                    </div>
                  </Field>
                </FieldGroup>
              </div>
            )}

            {tab === 'editor' && (
              <div className="flex flex-col gap-6">
                <FieldGroup title={t('settings.units')}>
                  <Field label={t('settings.units')}>
                    <Segmented
                      value={unitSystem}
                      options={unitOptions}
                      onChange={(value) => setPreference('unitSystem', value)}
                    />
                  </Field>
                  <Hint>{t('settings.unitsHelp')}</Hint>
                </FieldGroup>

                <FieldGroup title={t('settings.canvasDefaults')}>
                  <ToggleRow
                    label={t('settings.gridSnap')}
                    checked={gridSnapEnabled}
                    onChange={setGridSnap}
                  />
                  <ToggleRow
                    label={t('settings.smartGuides')}
                    checked={smartGuidesEnabled}
                    onChange={setSmartGuides}
                  />
                  <Field label={t('settings.gridSpacing')}>
                    <input
                      type="number"
                      min={4}
                      max={200}
                      value={gridSpacing}
                      onChange={(event) => setSpacing(Number(event.target.value))}
                      className="w-[88px] rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
                    />
                  </Field>
                </FieldGroup>
              </div>
            )}

            {tab === 'autosave' && (
              <div className="flex flex-col gap-6">
                <FieldGroup>
                  <Field label={t('settings.autosaveInterval')}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={autosaveIntervalSec}
                        onChange={(event) =>
                          setPreference(
                            'autosaveIntervalSec',
                            Math.max(2, Math.min(120, Number(event.target.value))),
                          )
                        }
                        className="w-[88px] rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
                      />
                      <span className="text-[11px] text-[var(--text-3)]">s</span>
                    </div>
                  </Field>
                  <Hint>{t('settings.autosaveHelp')}</Hint>
                </FieldGroup>

                <FieldGroup title={t('settings.storage')}>
                  <div className="rounded-[9px] border border-[var(--divider)] bg-[var(--glass-thin)] p-3 text-[12px] text-[var(--text-2)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-[var(--text)]">
                        {storage.available
                          ? storage.issues.length > 0
                            ? t('settings.storageWarning')
                            : t('settings.storageHealthy')
                          : t('settings.storageUnavailable')}
                      </div>
                      <button
                        type="button"
                        aria-label={t('settings.storageRefresh')}
                        onClick={() => void storage.refresh()}
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11.5px]">
                      <div>
                        {t('settings.storageUsage', {
                          used: formatBytes(storage.usage),
                          quota: formatBytes(storage.quota),
                        })}
                      </div>
                      <div>{t('settings.storageDrafts', { count: localeNumber(storage.draftCount) })}</div>
                      <div>{t('settings.storageRecents', { count: localeNumber(storage.recentCount) })}</div>
                      {storage.issues[0] && (
                        <div className="mt-1 text-[#ff3b30]">{storage.issues[0].message}</div>
                      )}
                    </div>
                  </div>
                </FieldGroup>
              </div>
            )}

            {tab === 'basemap' && (
              <FieldGroup>
                <Field label={t('settings.defaultBasemap')}>
                  <select
                    aria-label={t('settings.defaultBasemap')}
                    value={defaultBasemap}
                    onChange={(event) =>
                      setPreference('defaultBasemap', event.target.value as BuiltInBasemapPreset)
                    }
                    className={selectClass}
                  >
                    {BASEMAP_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Hint>{t('settings.defaultBasemapHelp')}</Hint>
              </FieldGroup>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-[var(--divider)] px-4 py-3">
          <button
            type="button"
            onClick={resetAll}
            className="flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[12px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <RotateCcw size={13} />
            {t('settings.reset')}
          </button>
        </div>
      </div>
    </div>
  );
}
