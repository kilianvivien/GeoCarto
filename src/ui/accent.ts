import type { AccentKey } from '@/state/preferencesStore';

/**
 * Accent presets (M21). `blue` is the design-system default and applies *no*
 * inline override, so the theme-specific `--accent*` tokens in tokens.css (which
 * differ subtly between light and dark) keep working. The other presets set the
 * four accent tokens on the document element; soft/ring are derived from the base
 * hue at fixed alphas so a single preset reads acceptably in both themes.
 */
interface AccentSpec {
  base: string;
  strong: string;
}

const ACCENT_SPECS: Record<Exclude<AccentKey, 'blue'>, AccentSpec> = {
  purple: { base: '#8b5cf6', strong: '#7c4ddb' },
  green: { base: '#22a55e', strong: '#1c8d50' },
  orange: { base: '#f97316', strong: '#e26309' },
  pink: { base: '#ec4899', strong: '#d83a87' },
};

const ACCENT_TOKENS = ['--accent', '--accent-strong', '--accent-soft', '--accent-ring'] as const;

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyAccent(accent: AccentKey): void {
  const root = document.documentElement;
  if (accent === 'blue') {
    // Fall back to the theme defaults by clearing any prior inline override.
    for (const token of ACCENT_TOKENS) root.style.removeProperty(token);
    return;
  }
  const spec = ACCENT_SPECS[accent];
  root.style.setProperty('--accent', spec.base);
  root.style.setProperty('--accent-strong', spec.strong);
  root.style.setProperty('--accent-soft', hexToRgba(spec.base, 0.16));
  root.style.setProperty('--accent-ring', hexToRgba(spec.base, 0.35));
}

export const ACCENT_SWATCH: Record<AccentKey, string> = {
  blue: '#007aff',
  purple: ACCENT_SPECS.purple.base,
  green: ACCENT_SPECS.green.base,
  orange: ACCENT_SPECS.orange.base,
  pink: ACCENT_SPECS.pink.base,
};
