import type { FillPattern } from '@/project/cartoproj';

/** Preset palette shared by the annotation and layer style inspectors. */
export const SWATCHES = ['#007aff', '#34c759', '#ff9500', '#ff3b30', '#af52de', '#111827', '#ffffff'];

export const FILL_PATTERNS: { value: FillPattern; label: string }[] = [
  { value: 'none', label: 'Solid' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'crosshatch', label: 'Crosshatch' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'dots', label: 'Dots' },
];

export function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}
