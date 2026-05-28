import type { PagePresetKey } from '@/project/cartoproj';

export interface PagePreset {
  key: PagePresetKey;
  label: string;
  /** Width at 1× DPI, in pixels (approx 150 DPI for print sizes — readable on screen, scales up cleanly with dpiScale). */
  width: number;
  height: number;
  /** Loose grouping for the dropdown. */
  family: 'print' | 'screen' | 'custom';
}

/**
 * Page preset catalog. Print sizes are computed at ~150 px-per-inch so they fit on
 * screen at 1× but produce 300+ DPI output when paired with `dpiScale: 2`.
 *
 * A4 = 8.27 × 11.69 in → 1240 × 1754 at 150 DPI
 * A3 = 11.69 × 16.54 in → 1754 × 2480 at 150 DPI
 * Letter = 8.5 × 11 in → 1275 × 1650 at 150 DPI
 * Tabloid = 11 × 17 in → 1650 × 2550 at 150 DPI
 */
export const PAGE_PRESETS: PagePreset[] = [
  { key: 'a4-portrait', label: 'A4 (portrait)', width: 1240, height: 1754, family: 'print' },
  { key: 'a4-landscape', label: 'A4 (landscape)', width: 1754, height: 1240, family: 'print' },
  { key: 'a3-portrait', label: 'A3 (portrait)', width: 1754, height: 2480, family: 'print' },
  { key: 'a3-landscape', label: 'A3 (landscape)', width: 2480, height: 1754, family: 'print' },
  { key: 'letter-portrait', label: 'Letter (portrait)', width: 1275, height: 1650, family: 'print' },
  { key: 'letter-landscape', label: 'Letter (landscape)', width: 1650, height: 1275, family: 'print' },
  { key: 'tabloid-landscape', label: 'Tabloid (landscape)', width: 2550, height: 1650, family: 'print' },
  { key: '16-9', label: '16:9 (1920×1080)', width: 1920, height: 1080, family: 'screen' },
  { key: '4-3', label: '4:3 (1600×1200)', width: 1600, height: 1200, family: 'screen' },
  { key: 'square', label: 'Square (1500×1500)', width: 1500, height: 1500, family: 'screen' },
  { key: 'custom', label: 'Custom', width: 0, height: 0, family: 'custom' },
];

export const PAGE_PRESET_BY_KEY: Record<PagePresetKey, PagePreset> = Object.fromEntries(
  PAGE_PRESETS.map((preset) => [preset.key, preset]),
) as Record<PagePresetKey, PagePreset>;

/** Look up the preset whose width × height matches the given dimensions. Returns `'custom'` for no match. */
export function detectPreset(width: number, height: number): PagePresetKey {
  const match = PAGE_PRESETS.find(
    (preset) => preset.key !== 'custom' && preset.width === width && preset.height === height,
  );
  return match?.key ?? 'custom';
}

/** Swap width/height for a preset — useful for landscape↔portrait toggles. */
export function rotatePreset(preset: PagePreset): { width: number; height: number } {
  return { width: preset.height, height: preset.width };
}
