import { getStroke } from 'perfect-freehand';
import type { AnnotationStyle, BrushPreset } from '@/project/cartoproj';
import { strokeDash } from '@/style/annotationPatterns';

/**
 * Variable-width brush geometry for pressure strokes (Apple Pencil).
 *
 * A brush line drawn with a pressure-capable pen stores one normalized
 * pressure sample per point (`LineAnnotation.pressures`). Every renderer —
 * the Konva editor stage, the Konva raster exporter, and the SVG exporter
 * (which PDF and HTML exports build on) — turns that into the same filled
 * outline polygon via this module, so the stroke looks identical everywhere.
 * Strokes without pressure data keep the classic uniform-width rendering.
 */

/**
 * Pressure-to-width influence passed to perfect-freehand. With its linear
 * easing the rendered width is `size * (1 - THINNING * (1 - 2 * pressure))` —
 * exactly `size` at mid pressure, so a mid-pressure pen stroke matches the
 * uniform-width stroke a mouse draws with the same settings.
 */
const THINNING = 0.6;

/**
 * Uniform-width stroke styling for each brush preset — the single source both
 * the editor and every exporter render from.
 */
export function brushStrokeProps(
  style: AnnotationStyle,
  preset: BrushPreset | undefined,
  opacity: number,
) {
  switch (preset ?? 'round') {
    case 'marker':
      return { strokeWidth: style.strokeWidth * 1.8, opacity: opacity * 0.78, dash: undefined };
    case 'pencil':
      return {
        strokeWidth: Math.max(1, style.strokeWidth * 0.9),
        opacity: opacity * 0.68,
        dash: [1, 5],
      };
    case 'highlighter':
      return { strokeWidth: style.strokeWidth * 3.5, opacity: opacity * 0.42, dash: undefined };
    case 'round':
      return { strokeWidth: style.strokeWidth, opacity, dash: strokeDash(style) };
  }
}

/** Preset width multipliers — must mirror `brushStrokeProps` above. */
function presetWidth(strokeWidth: number, preset: BrushPreset | undefined): number {
  switch (preset ?? 'round') {
    case 'marker':
      return strokeWidth * 1.8;
    case 'pencil':
      return Math.max(1, strokeWidth * 0.9);
    case 'highlighter':
      return strokeWidth * 3.5;
    case 'round':
      return strokeWidth;
  }
}

/** Clamp a raw PointerEvent.pressure into a usable range (0 means "unknown"). */
export function normalizePressure(pressure: number | undefined): number {
  if (typeof pressure !== 'number' || Number.isNaN(pressure) || pressure <= 0) return 0.5;
  return Math.min(1, pressure);
}

/**
 * True when a brush line carries usable pressure data: one sample per point
 * and at least some variation (a constant-pressure stroke renders identically
 * to — and stays on — the uniform-width path, which preserves preset dashes).
 */
export function hasPressureProfile(
  points: number[],
  pressures: number[] | undefined,
): pressures is number[] {
  if (!Array.isArray(pressures) || pressures.length < 2) return false;
  if (pressures.length * 2 !== points.length) return false;
  return pressures.some((value) => Math.abs(value - pressures[0]) > 0.01);
}

/**
 * Filled outline polygon for a pressure stroke, as flat [x0,y0,x1,y1,…]
 * local coordinates. `extraWidth` inflates the stroke uniformly on both sides
 * (used for halo rendering).
 */
export function brushOutlinePoints(
  points: number[],
  pressures: number[],
  strokeWidth: number,
  preset: BrushPreset | undefined,
  extraWidth = 0,
): number[] {
  const input: [number, number, number][] = [];
  for (let index = 0; index < pressures.length; index += 1) {
    input.push([points[index * 2], points[index * 2 + 1], pressures[index]]);
  }
  const outline = getStroke(input, {
    size: presetWidth(strokeWidth, preset) + extraWidth * 2,
    thinning: THINNING,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: false,
    last: true,
  });
  const flat: number[] = [];
  for (const [x, y] of outline) flat.push(x, y);
  return flat;
}

/**
 * SVG path (`d`) for an outline polygon, smoothed with the standard
 * midpoint-quadratic technique so the exported curve matches the editor.
 */
export function outlineToSvgPath(outline: number[]): string {
  if (outline.length < 6) return '';
  const fmt = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? '0' : String(rounded);
  };
  const count = outline.length / 2;
  let d = `M${fmt(outline[0])} ${fmt(outline[1])} Q`;
  for (let index = 0; index < count; index += 1) {
    const x0 = outline[index * 2];
    const y0 = outline[index * 2 + 1];
    const next = (index + 1) % count;
    const x1 = outline[next * 2];
    const y1 = outline[next * 2 + 1];
    d += ` ${fmt(x0)} ${fmt(y0)} ${fmt((x0 + x1) / 2)} ${fmt((y0 + y1) / 2)}`;
  }
  return `${d} Z`;
}
