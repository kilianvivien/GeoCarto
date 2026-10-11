import { describe, expect, it } from 'vitest';
import type { Feature } from 'geojson';
import { categoryColorExpression, fillColorExpression, lineColorExpression, pointColorExpression } from '@/canvas/syncLayers';
import { DEFAULT_GEOJSON_STYLE, type CategoricalStyle, type GeoJsonLayer } from '@/project/cartoproj';
import {
  MAX_CATEGORIES,
  buildCategoricalStyle,
  categoryColor,
  countOther,
  defaultCategoricalAttribute,
  listCategoricalAttributes,
  listCategoryValues,
} from './categories';
import { resolveFillColor, resolveLineColor, resolvePointColor } from './dataStyleEvaluate';
import { categoricalLegendEntries } from './legendSwatches';
import { rampById } from './ramps';

const feature = (properties: Record<string, unknown>, type: 'Point' | 'Polygon' | 'LineString' = 'Polygon'): Feature => ({
  type: 'Feature',
  properties,
  geometry:
    type === 'Point'
      ? { type: 'Point', coordinates: [0, 0] }
      : type === 'LineString'
        ? { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
        : { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
});

const zones = [
  feature({ nom: 'A', type: 'urbain', code: 1 }),
  feature({ nom: 'B', type: 'rural', code: 2 }),
  feature({ nom: 'C', type: 'urbain', code: 3 }),
  feature({ nom: 'D', type: null, code: 4 }),
  feature({ nom: 'E', type: 'urbain', code: 5 }),
];

function layerOf(features: Feature[], dataStyle: CategoricalStyle, geometry: GeoJsonLayer['geometry'] = 'polygon'): GeoJsonLayer {
  return {
    id: 'l', kind: 'geojson', name: 'Zones', visible: true, locked: false, geometry,
    featureCount: features.length, data: { type: 'FeatureCollection', features },
    style: { ...DEFAULT_GEOJSON_STYLE, strokeColor: '#111111', dataStyle },
  };
}

describe('category discovery', () => {
  it('lists values by frequency and skips blanks', () => {
    expect(listCategoryValues(zones, 'type')).toEqual([
      { value: 'urbain', count: 3 },
      { value: 'rural', count: 1 },
    ]);
  });

  it('offers repeating attributes, not ones unique to every feature', () => {
    const many = Array.from({ length: 40 }, (_, i) => feature({ id: `f${i}`, type: i % 3 ? 'a' : 'b' }));
    expect(listCategoricalAttributes(many)).toEqual(['type']);
    // On a small layer everything is few enough to list.
    expect(listCategoricalAttributes(zones)).toEqual(['code', 'nom', 'type']);
  });

  it('starts from the text attribute with the fewest distinct values', () => {
    expect(defaultCategoricalAttribute(zones)).toBe('type');
    expect(defaultCategoricalAttribute([feature({ n: 1 }), feature({ n: 2 })])).toBe('n');
    expect(defaultCategoricalAttribute([])).toBe('');
  });
});

describe('buildCategoricalStyle', () => {
  const palette = rampById('set2').colors;

  it('assigns palette colors to the most frequent values', () => {
    const style = buildCategoricalStyle(zones, 'type');
    expect(style.categories).toEqual([
      { value: 'urbain', color: palette[0] },
      { value: 'rural', color: palette[1] },
    ]);
    expect(countOther(zones, style)).toBe(1);
  });

  it('keeps hand-picked colors when the same attribute is rebuilt', () => {
    const edited = { ...buildCategoricalStyle(zones, 'type'), otherColor: '#000000' };
    edited.categories = [{ value: 'rural', color: '#123456' }];
    const rebuilt = buildCategoricalStyle(zones, 'type', edited);
    expect(rebuilt.categories).toEqual([
      { value: 'urbain', color: palette[0] },
      { value: 'rural', color: '#123456' },
    ]);
    expect(rebuilt.otherColor).toBe('#000000');
  });

  it('caps the list and folds the rest into "other"', () => {
    const many = Array.from({ length: 30 }, (_, i) => feature({ k: `v${i % 20}` }));
    const style = buildCategoricalStyle(many, 'k');
    expect(style.categories).toHaveLength(MAX_CATEGORIES);
    expect(countOther(many, style)).toBeGreaterThan(0);
  });
});

describe('categorical rendering agrees across backends', () => {
  const style = buildCategoricalStyle(zones, 'type');
  const layer = layerOf(zones, style);

  it('resolves per-feature colors for Canvas/SVG', () => {
    expect(categoryColor(zones[0], style)).toBe(style.categories[0].color);
    expect(resolveFillColor(zones[1], layer)).toBe(style.categories[1].color);
    expect(resolveFillColor(zones[3], layer)).toBe(style.otherColor);
    expect(resolvePointColor(feature({ type: 'rural' }, 'Point'), layer)).toBe(style.categories[1].color);
    expect(resolveLineColor(feature({ type: 'rural' }, 'LineString'), layer)).toBe(style.categories[1].color);
    // A polygon's outline is not a category symbol.
    expect(resolveLineColor(zones[0], layer)).toBe('#111111');
  });

  it('builds the equivalent MapLibre expressions', () => {
    const match = ['match', ['to-string', ['get', 'type']], 'urbain', style.categories[0].color, 'rural', style.categories[1].color, style.otherColor];
    expect(categoryColorExpression(style)).toEqual(match);
    expect(fillColorExpression(layer)).toEqual(match);
    expect(pointColorExpression(layer)).toEqual(match);
    expect(lineColorExpression(layer)).toEqual(['match', ['geometry-type'], ['LineString', 'MultiLineString'], match, '#111111']);
  });

  it('degrades to a constant when no category is listed', () => {
    const empty: CategoricalStyle = { kind: 'categorical', attribute: 'type', categories: [], otherColor: '#abcdef' };
    expect(categoryColorExpression(empty)).toBe('#abcdef');
    expect(lineColorExpression(layerOf(zones, empty))).toBe('#111111');
  });
});

describe('categoricalLegendEntries', () => {
  const style = buildCategoricalStyle(zones, 'type');

  it('lists each category plus "Other" with fill swatches for polygons', () => {
    const entries = categoricalLegendEntries(style, layerOf(zones, style));
    expect(entries.map((entry) => entry.label)).toEqual(['urbain', 'rural', 'Other']);
    expect(entries[0].symbol).toMatchObject({ kind: 'fill', fillColor: style.categories[0].color });
  });

  it('uses the layer own symbol for points and lines, and omits "Other" when unused', () => {
    const complete = zones.filter((f) => f.properties?.type);
    expect(categoricalLegendEntries(style, layerOf(complete, style, 'point')).map((e) => e.symbol?.kind)).toEqual(['circle', 'circle']);
    expect(categoricalLegendEntries(style, layerOf(complete, style, 'line'))[0].symbol).toMatchObject({ kind: 'line', strokeColor: style.categories[0].color });
  });
});
