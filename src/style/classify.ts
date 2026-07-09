import type { Feature } from 'geojson';
import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';

export type ClassificationMethod = 'quantile' | 'equal' | 'jenks' | 'manual';

/** Coerce a raw property value to a finite number, or null when it can't represent one. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export interface AttributeStats {
  /** Numeric values found, ascending. */
  values: number[];
  missingCount: number;
  totalCount: number;
}

/** Scan a layer's features for one attribute, coercing to numbers and counting misses. */
export function scanAttribute(features: Feature[], attribute: string): AttributeStats {
  const values: number[] = [];
  let missingCount = 0;
  for (const feature of features) {
    const raw = feature.properties?.[attribute];
    const num = coerceNumber(raw);
    if (num === null) missingCount++;
    else values.push(num);
  }
  values.sort((a, b) => a - b);
  return { values, missingCount, totalCount: features.length };
}

/**
 * Attribute names that carry at least one coercible numeric value, for the
 * "style by data" attribute picker. Excludes the internal per-feature fill key.
 */
export function listNumericAttributes(features: Feature[]): string[] {
  const found = new Set<string>();
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      if (key === FEATURE_FILL_PROPERTY || found.has(key)) continue;
      if (coerceNumber(value) !== null) found.add(key);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

/** All attribute names present on any feature (for proportional-symbol pickers too). */
export function listAllAttributes(features: Feature[]): string[] {
  const found = new Set<string>();
  for (const feature of features) {
    for (const key of Object.keys(feature.properties ?? {})) {
      if (key !== FEATURE_FILL_PROPERTY) found.add(key);
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function interpolatedQuantile(sorted: number[], fraction: number): number {
  const index = fraction * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function quantileBreaks(sorted: number[], classCount: number): number[] {
  const breaks: number[] = [];
  for (let i = 1; i < classCount; i++) {
    breaks.push(interpolatedQuantile(sorted, i / classCount));
  }
  return breaks;
}

function equalIntervalBreaks(sorted: number[], classCount: number): number[] {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const span = max - min;
  const breaks: number[] = [];
  for (let i = 1; i < classCount; i++) {
    breaks.push(min + (span * i) / classCount);
  }
  return breaks;
}

/**
 * Fisher–Jenks natural-breaks optimization (classic DP formulation). O(n² · k) —
 * above `JENKS_SAMPLE_THRESHOLD` points we sample evenly rather than let a
 * 10k+ feature layer stall the UI; the sample is large enough that the
 * resulting breaks are visually indistinguishable from the exact solution.
 */
const JENKS_SAMPLE_THRESHOLD = 2000;

function sampleSorted(sorted: number[], maxSize: number): number[] {
  if (sorted.length <= maxSize) return sorted;
  const step = sorted.length / maxSize;
  const sample: number[] = [];
  for (let i = 0; i < maxSize; i++) sample.push(sorted[Math.floor(i * step)]);
  sample[sample.length - 1] = sorted[sorted.length - 1];
  return sample;
}

function jenksBreaks(sorted: number[], classCount: number): number[] {
  const data = sampleSorted(sorted, JENKS_SAMPLE_THRESHOLD);
  const n = data.length;
  const lowerClassLimits: number[][] = Array.from({ length: n + 1 }, () => new Array(classCount + 1).fill(0));
  const varianceCombinations: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(classCount + 1).fill(Infinity),
  );

  for (let i = 1; i <= classCount; i++) {
    lowerClassLimits[1][i] = 1;
    varianceCombinations[1][i] = 0;
  }

  let variance = 0;
  for (let l = 2; l <= n; l++) {
    let sum = 0;
    let sumSquares = 0;
    let w = 0;
    for (let m = 1; m <= l; m++) {
      const lowerClassLimit = l - m + 1;
      const value = data[lowerClassLimit - 1];
      sumSquares += value * value;
      sum += value;
      w++;
      variance = sumSquares - (sum * sum) / w;
      const i4 = lowerClassLimit - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= classCount; j++) {
          if (varianceCombinations[l][j] >= variance + varianceCombinations[i4][j - 1]) {
            lowerClassLimits[l][j] = lowerClassLimit;
            varianceCombinations[l][j] = variance + varianceCombinations[i4][j - 1];
          }
        }
      }
    }
    lowerClassLimits[l][1] = 1;
    varianceCombinations[l][1] = variance;
  }

  const boundaries = new Array<number>(classCount + 1);
  boundaries[classCount] = data[n - 1];
  boundaries[0] = data[0];
  let k = n;
  for (let j = classCount; j >= 2; j--) {
    // `id` is the last index of the lower class; `id + 1` is the first index of
    // the upper class. The DP naturally returns `data[id]` (the lower class's
    // own max) as the "break", but consumers (the MapLibre `step` expression,
    // quantile/equal breaks) expect a threshold strictly *between* classes —
    // otherwise a value sitting exactly on a cluster's max gets classified into
    // the class above it. Split the difference so all methods share one convention.
    const id = lowerClassLimits[k][j] - 2;
    boundaries[j - 1] = (data[id] + data[id + 1]) / 2;
    k = lowerClassLimits[k][j] - 1;
  }
  return boundaries.slice(1, classCount);
}

/**
 * Drop non-increasing entries from an ascending break list. MapLibre's `step`
 * expression requires strictly ascending stops; quantile breaks in particular
 * can repeat a value when the data is skewed or heavily discrete (e.g. many
 * repeated values), even though the attribute has enough distinct values to
 * satisfy the requested class count.
 */
export function dedupeAscending(breaks: number[]): number[] {
  const result: number[] = [];
  for (const value of breaks) {
    if (result.length === 0 || value > result[result.length - 1]) result.push(value);
  }
  return result;
}

/**
 * Compute interior breaks for a classification method (length may be less
 * than `classCount - 1` after deduplication — see {@link dedupeAscending}).
 * `manual` is not handled here — callers keep the user's own edited breaks.
 * Degenerate inputs (fewer than 2 distinct values) return no breaks so the
 * caller can fall back to a single class.
 */
export function computeBreaks(values: number[], method: ClassificationMethod, classCount: number): number[] {
  const distinct = new Set(values);
  if (distinct.size < 2 || classCount < 2) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const effectiveClassCount = Math.min(classCount, distinct.size);

  switch (method) {
    case 'equal':
      return dedupeAscending(equalIntervalBreaks(sorted, effectiveClassCount));
    case 'jenks':
      return dedupeAscending(jenksBreaks(sorted, effectiveClassCount));
    case 'quantile':
    case 'manual':
    default:
      return dedupeAscending(quantileBreaks(sorted, effectiveClassCount));
  }
}
