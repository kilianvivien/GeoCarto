import { describe, expect, it } from 'vitest';
import type { Feature, Geometry } from 'geojson';
import { DEFAULT_GEOJSON_STYLE, type GeoJsonLayer, type LabelStyle } from '@/project/cartoproj';
import { labelFontFor, labelLayerStyle, labelSourceData } from '@/canvas/syncLayers';
import { labelAnchor, labelLines, layerLabels } from './labels';

const labels: LabelStyle = { attribute: 'nom', size: 12, color: '#000000', halo: true };
const feature = (properties: Record<string, unknown> | null, geometry: Geometry): Feature => ({ type: 'Feature', properties, geometry });
const square = (x: number, y: number, size: number) => [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]];

function layerOf(features: Feature[], style: Partial<GeoJsonLayer['style']> = {}): GeoJsonLayer {
  return {
    id: 'l', kind: 'geojson', name: 'L', visible: true, locked: false, geometry: 'mixed',
    featureCount: features.length, data: { type: 'FeatureCollection', features },
    style: { ...DEFAULT_GEOJSON_STYLE, labels, ...style },
  };
}

describe('labelLines', () => {
  const paris = feature({ nom: ' Paris ', taux: 12.456, vide: null }, { type: 'Point', coordinates: [2, 48] });

  it('shows the attribute, trimmed', () => {
    expect(labelLines(paris, labels)).toEqual(['Paris']);
  });

  it('adds a rounded value line with its suffix', () => {
    expect(labelLines(paris, { ...labels, valueAttribute: 'taux', valueSuffix: ' %' })).toEqual(['Paris', '12.46 %']);
  });

  it('drops empty lines rather than printing a bare suffix', () => {
    expect(labelLines(paris, { ...labels, valueAttribute: 'vide', valueSuffix: ' %' })).toEqual(['Paris']);
    expect(labelLines(paris, { ...labels, attribute: 'absent' })).toEqual([]);
  });
});

describe('labelAnchor', () => {
  it('uses a point as is and the middle of a line', () => {
    expect(labelAnchor({ type: 'Point', coordinates: [2, 48] })).toEqual([2, 48]);
    expect(labelAnchor({ type: 'LineString', coordinates: [[0, 0], [10, 0], [10, 10]] })).toEqual([10, 0]);
  });

  it('centers on a convex polygon', () => {
    const [x, y] = labelAnchor({ type: 'Polygon', coordinates: square(0, 0, 10) })!;
    expect(x).toBeCloseTo(5, 0);
    expect(y).toBeCloseTo(5, 0);
  });

  it('stays inside a concave polygon whose centroid falls outside it', () => {
    // A "U": the centroid sits in the notch, between the two arms.
    const u = [[[0, 0], [10, 0], [10, 10], [8, 10], [8, 2], [2, 2], [2, 10], [0, 10], [0, 0]]];
    const [x, y] = labelAnchor({ type: 'Polygon', coordinates: u })!;
    const inNotch = x > 2 && x < 8 && y > 2;
    expect(inNotch).toBe(false);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(10);
  });

  it('labels a multi-part geometry once, on its largest part', () => {
    const [x] = labelAnchor({ type: 'MultiPolygon', coordinates: [square(0, 0, 1), square(100, 0, 10)] })!;
    expect(x).toBeCloseTo(105, 0);
    expect(labelAnchor({ type: 'MultiLineString', coordinates: [[[0, 0], [1, 0]], [[0, 5], [20, 5]]] })).toEqual([10, 5]);
  });

  it('returns null without geometry', () => {
    expect(labelAnchor(null)).toBeNull();
    expect(labelAnchor({ type: 'Polygon', coordinates: [] })).toBeNull();
  });
});

describe('layerLabels', () => {
  const features = [
    feature({ nom: 'Zone' }, { type: 'Polygon', coordinates: square(0, 0, 10) }),
    feature({ nom: 'Ville' }, { type: 'Point', coordinates: [20, 20] }),
    feature({ nom: '' }, { type: 'Point', coordinates: [30, 30] }),
    feature(null, { type: 'Point', coordinates: [40, 40] }),
  ];

  it('centers area labels and hangs point labels below their symbol', () => {
    const [zone, ville, ...rest] = layerLabels(layerOf(features, { pointRadius: 6 }));
    expect(rest).toEqual([]);
    expect(zone).toMatchObject({ lines: ['Zone'], offset: 0 });
    expect(ville).toMatchObject({ position: [20, 20], lines: ['Ville'], offset: 9 });
  });

  it('centers point labels when the points themselves are hidden', () => {
    expect(layerLabels(layerOf(features, { showPoints: false }))[1].offset).toBe(0);
  });

  it('is empty without a label style or on heatmaps, and memoized per collection', () => {
    expect(layerLabels(layerOf(features, { labels: undefined }))).toEqual([]);
    expect(layerLabels({ ...layerOf(features), renderStrategy: 'heatmap' })).toEqual([]);
    const layer = layerOf(features);
    expect(layerLabels(layer)).toBe(layerLabels(layer));
    // A text change invalidates the cache even though the data is the same object.
    const renamed = { ...layer, style: { ...layer.style, labels: { ...labels, valueAttribute: 'nom' } } };
    expect(layerLabels(renamed)).not.toBe(layerLabels(layer));
  });
});

describe('MapLibre label layer', () => {
  it('carries text and offset per label point', () => {
    const data = labelSourceData([{ position: [1, 2], lines: ['Paris', '12 %'], offset: 9 }]);
    expect(data.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1, 2] },
      properties: { text: 'Paris\n12 %', offset: 9 },
    });
  });

  it('styles size, color, and halo from the label style', () => {
    const { layout, paint } = labelLayerStyle(layerOf([], { labels: { ...labels, size: 20, halo: false } }), ['Font']);
    expect(layout['text-size']).toBe(20);
    expect(layout['text-font']).toEqual(['Font']);
    expect(paint['text-halo-width']).toBe(0);
  });

  it('picks an upright font the style already uses, or the fallback', () => {
    const style = {
      glyphs: 'https://example.test/{fontstack}/{range}.pbf',
      layers: [
        { layout: { 'text-font': ['Noto Sans Italic'] } },
        { layout: { 'text-font': ['Noto Sans Medium'] } },
        { layout: { 'text-font': ['Noto Sans Regular'] } },
      ],
    };
    expect(labelFontFor(style)).toEqual(['Noto Sans Regular']);
    expect(labelFontFor({ ...style, layers: style.layers.slice(0, 2) })).toEqual(['Noto Sans Medium']);
    expect(labelFontFor({ layers: style.layers })).toEqual(['Noto Sans Regular']);
    expect(labelFontFor(null)).toEqual(['Noto Sans Regular']);
  });
});
