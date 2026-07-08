export type RampKind = 'sequential' | 'diverging' | 'categorical';

export interface ColorRamp {
  id: string;
  name: string;
  kind: RampKind;
  /** ColorBrewer-derived 9-stop (or 8-stop for some qualitative sets) reference. */
  colors: string[];
  /** Safe for red-green and blue-yellow color-vision deficiencies (ColorBrewer rating). */
  colorblindSafe: boolean;
}

/**
 * Curated, ColorBrewer-derived palette catalog. Each entry stores its widest
 * (9-stop) reference array; `sampleRamp` picks an evenly spaced subset for
 * smaller class counts rather than hand-storing a table per class count.
 */
export const COLOR_RAMPS: ColorRamp[] = [
  {
    id: 'blues',
    name: 'Blues',
    kind: 'sequential',
    colorblindSafe: true,
    colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
  },
  {
    id: 'greens',
    name: 'Greens',
    kind: 'sequential',
    colorblindSafe: true,
    colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
  },
  {
    id: 'oranges',
    name: 'Oranges',
    kind: 'sequential',
    colorblindSafe: true,
    colors: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
  },
  {
    id: 'purples',
    name: 'Purples',
    kind: 'sequential',
    colorblindSafe: true,
    colors: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
  },
  {
    id: 'ylorrd',
    name: 'Yellow–Orange–Red',
    kind: 'sequential',
    colorblindSafe: true,
    colors: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
  },
  {
    id: 'rdbu',
    name: 'Red–Blue',
    kind: 'diverging',
    colorblindSafe: false,
    colors: ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac'],
  },
  {
    id: 'prgn',
    name: 'Purple–Green',
    kind: 'diverging',
    colorblindSafe: true,
    colors: ['#762a83', '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837'],
  },
  {
    id: 'brbg',
    name: 'Brown–Teal',
    kind: 'diverging',
    colorblindSafe: true,
    colors: ['#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e'],
  },
  {
    id: 'set2',
    name: 'Set 2 (categorical)',
    kind: 'categorical',
    colorblindSafe: true,
    colors: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
  },
  {
    id: 'set1',
    name: 'Set 1 (categorical)',
    kind: 'categorical',
    colorblindSafe: false,
    colors: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
  },
];

export const DEFAULT_RAMP_ID = 'blues';

export function rampById(id: string): ColorRamp {
  return COLOR_RAMPS.find((ramp) => ramp.id === id) ?? COLOR_RAMPS[0];
}

/** Pick `count` evenly spaced colors from a ramp's reference stops. */
export function sampleRamp(id: string, count: number, reverse = false): string[] {
  const ramp = rampById(id);
  const n = Math.max(1, count);
  const stops = ramp.colors;
  const picked: string[] =
    n === 1
      ? [stops[Math.floor((stops.length - 1) / 2)]]
      : Array.from({ length: n }, (_, i) => stops[Math.round((i * (stops.length - 1)) / (n - 1))]);
  return reverse ? picked.reverse() : picked;
}
