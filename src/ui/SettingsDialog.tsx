import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { LOCALE_OPTIONS, type LocaleMode } from '@/i18n/locales';
import { useLocale } from '@/i18n/useLocale';
import { useToolStore } from '@/state/toolStore';
import { useTheme, type Theme } from './useTheme';

const TRANSITION_MS = 220;

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
    <label className="flex items-center justify-between gap-3 text-[12px] text-[var(--text-2)]">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {title}
      </div>
      {children}
    </section>
  );
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

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const t = useLocale((s) => s.t);
  const localeMode = useLocale((s) => s.mode);
  const setLocaleMode = useLocale((s) => s.setMode);
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const gridSnapEnabled = useToolStore((s) => s.gridSnapEnabled);
  const gridSpacing = useToolStore((s) => s.gridSpacing);
  const smartGuidesEnabled = useToolStore((s) => s.smartGuidesEnabled);
  const { setGridSnapEnabled, setGridSpacing, setSmartGuidesEnabled } = useToolStore.getState();

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

  if (!mounted) return null;

  const themeOptions: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
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
        className={`glass w-[430px] rounded-[var(--radius-md)] bg-[var(--surface-modal)] p-5 text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[14px] font-semibold">{t('settings.title')}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
              {t('settings.subtitle')}
            </div>
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

        <div className="mt-5 flex flex-col gap-5">
          <Section title={t('settings.general')}>
            <label className="grid grid-cols-[96px_1fr] items-center gap-2 text-[12px] text-[var(--text-2)]">
              <span>{t('settings.language')}</span>
              <select
                value={localeMode}
                onChange={(event) => setLocaleMode(event.target.value as LocaleMode)}
                className="min-w-0 rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
              >
                {localeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-[11px] text-[var(--text-3)]">{t('settings.languageHelp')}</div>
          </Section>

          <Section title={t('settings.appearance')}>
            <div className="grid grid-cols-[96px_1fr] items-center gap-2 text-[12px] text-[var(--text-2)]">
              <span>{t('settings.theme')}</span>
              <Segmented value={theme} options={themeOptions} onChange={setTheme} />
            </div>
          </Section>

          <Section title={t('settings.canvas')}>
            <ToggleRow
              label={t('settings.gridSnap')}
              checked={gridSnapEnabled}
              onChange={setGridSnapEnabled}
            />
            <ToggleRow
              label={t('settings.smartGuides')}
              checked={smartGuidesEnabled}
              onChange={setSmartGuidesEnabled}
            />
            <label className="grid grid-cols-[1fr_76px] items-center gap-2 text-[12px] text-[var(--text-2)]">
              <span>{t('settings.gridSpacing')}</span>
              <input
                type="number"
                min={4}
                max={200}
                value={gridSpacing}
                onChange={(event) => setGridSpacing(Number(event.target.value))}
                className="rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>
          </Section>
        </div>
      </div>
    </div>
  );
}
