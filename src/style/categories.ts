import type { Feature } from 'geojson';
import type { CategoricalStyle } from '@/project/cartoproj';
import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';
import { rampById } from './ramps';

/** Beyond this many classes a qualitative map stops being readable; the rest fold into "other". */
export const MAX_CATEGORIES = 12;
export const DEFAULT_CATEGORY_PALETTE_ID = 'set2';
export const DEFAULT_OTHER_COLOR = '#cccccc';

/**
 * The text a feature's attribute value is matched on. Deliberately mirrors
 * MapLibre's `to-string` (null → ""), not trimmed, so the Canvas/SVG renderers
 * and the GPU `match` expression can never disagree about a feature's category.
 */
export function categoryKey(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Distinct values of an attribute, most frequent first (ties alphabetical). Blank values are skipped. */
export function listCategoryValues(features: Feature[], attribute: string): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const feature of features) {
    const key = categoryKey(feature.properties?.[attribute]);
    if (key !== '') counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Attributes worth offering for categorical styling: at least one value, and
 * few enough distinct ones to repeat across features (an id or a name unique
 * to every feature makes a legend as long as the layer).
 */
export function listCategoricalAttributes(features: Feature[]): string[] {
  const values = new Map<string, Set<string>>();
  for (const feature of features) {
    for (const [key, value] of Object.entries(feature.properties ?? {})) {
      if (key === FEATURE_FILL_PROPERTY) continue;
      const text = categoryKey(value);
      if (text === '') continue;
      let seen = values.get(key);
      if (!seen) values.set(key, (seen = new Set()));
      // No need to count past the point where the attribute is disqualified.
      if (seen.size <= MAX_CATEGORIES * 4) seen.add(text);
    }
  }
  const limit = Math.max(MAX_CATEGORIES, features.length / 2);
  return [...values.entries()]
    .filter(([, seen]) => seen.size <= limit && seen.size <= MAX_CATEGORIES * 4)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * The attribute to start from when the user turns categorical styling on: a
 * text attribute beats a numeric one (numbers usually want a choropleth), and
 * fewer distinct values beat more — "type" rather than "name".
 */
export function defaultCategoricalAttribute(features: Feature[]): string {
  let best: { attribute: string; text: boolean; distinct: number } | null = null;
  for (const attribute of listCategoricalAttributes(features)) {
    const values = listCategoryValues(features, attribute);
    const candidate = {
      attribute,
      text: values.some(({ value }) => !Number.isFinite(Number(value))),
      // A single value colors everything alike; rank it last.
      distinct: values.length > 1 ? values.length : Infinity,
    };
    if (
      !best ||
      (candidate.text && !best.text) ||
      (candidate.text === best.text && candidate.distinct < best.distinct)
    ) {
      best = candidate;
    }
  }
  return best?.attribute ?? '';
}

/**
 * Build a categorical style for an attribute: the most frequent values each
 * get a palette color. Colors the user already picked for a value are kept
 * when the same attribute is rebuilt (e.g. after a data edit).
 */
export function buildCategoricalStyle(
  features: Feature[],
  attribute: string,
  current?: CategoricalStyle | null,
  paletteId = DEFAULT_CATEGORY_PALETTE_ID,
): CategoricalStyle {
  const palette = rampById(paletteId).colors;
  const kept = new Map(current?.attribute === attribute ? current.categories.map((c) => [c.value, c.color]) : []);
  const used = new Set(kept.values());
  const fresh = palette.filter((color) => !used.has(color));
  let next = 0;
  const categories = listCategoryValues(features, attribute)
    .slice(0, MAX_CATEGORIES)
    .map(({ value }) => ({
      value,
      // Once the palette is exhausted it repeats; the user can recolor by hand.
      color: kept.get(value) ?? fresh[next++] ?? palette[(next++ - fresh.length) % palette.length],
    }));
  return {
    kind: 'categorical',
    attribute,
    categories,
    otherColor: (current?.attribute === attribute ? current.otherColor : undefined) ?? DEFAULT_OTHER_COLOR,
  };
}

/** A feature's color under a categorical style. */
export function categoryColor(feature: Feature, style: CategoricalStyle): string {
  const key = categoryKey(feature.properties?.[style.attribute]);
  return style.categories.find((category) => category.value === key)?.color ?? style.otherColor;
}

/** How many features fall outside the listed categories (drives the legend's "Other" row). */
export function countOther(features: Feature[], style: CategoricalStyle): number {
  const listed = new Set(style.categories.map((category) => category.value));
  return features.reduce(
    (count, feature) => count + (listed.has(categoryKey(feature.properties?.[style.attribute])) ? 0 : 1),
    0,
  );
}
