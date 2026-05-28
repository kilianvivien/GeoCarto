import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import {
  DEFAULT_BASEMAP,
  DEFAULT_BASEMAP_SUBLAYERS,
  type BasemapConfig,
} from '@/project/cartoproj';
import { applySublayerVisibility, buildBasemapStyle } from './basemapStyle';

function fakeLayer(id: string, sourceLayer: string): LayerSpecification {
  return {
    id,
    type: 'fill',
    source: 'protomaps',
    'source-layer': sourceLayer,
  } as LayerSpecification;
}

describe('applySublayerVisibility', () => {
  const layers: LayerSpecification[] = [
    fakeLayer('earth', 'earth'),
    fakeLayer('roads-1', 'roads'),
    fakeLayer('water-1', 'water'),
    fakeLayer('landuse-1', 'landuse'),
    fakeLayer('landcover-1', 'landcover'),
    fakeLayer('buildings-1', 'buildings'),
    fakeLayer('boundaries-1', 'boundaries'),
    fakeLayer('places-1', 'places'),
    fakeLayer('pois-1', 'pois'),
  ];

  it('keeps all layers when every sub-layer is visible', () => {
    expect(applySublayerVisibility(layers, DEFAULT_BASEMAP_SUBLAYERS)).toHaveLength(layers.length);
  });

  it('drops the matching source-layer when a sub-layer is hidden', () => {
    const out = applySublayerVisibility(layers, { ...DEFAULT_BASEMAP_SUBLAYERS, roads: false });
    expect(out.find((layer) => layer.id === 'roads-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'water-1')).toBeDefined();
  });

  it('treats labels as places + pois and landuse as landuse + landcover', () => {
    const out = applySublayerVisibility(layers, {
      ...DEFAULT_BASEMAP_SUBLAYERS,
      labels: false,
      landuse: false,
    });
    expect(out.find((layer) => layer.id === 'places-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'pois-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'landuse-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'landcover-1')).toBeUndefined();
  });

  it('preserves background / earth layers without a source-layer match', () => {
    const out = applySublayerVisibility(layers, {
      roads: false,
      labels: false,
      water: false,
      landuse: false,
      buildings: false,
      boundaries: false,
    });
    expect(out.find((layer) => layer.id === 'earth')).toBeDefined();
  });
});

describe('buildBasemapStyle', () => {
  it('emits filtered layers for a built-in preset with sub-layers hidden', () => {
    if (DEFAULT_BASEMAP.kind !== 'builtin') throw new Error('DEFAULT_BASEMAP must be builtin');
    const config: BasemapConfig = {
      kind: 'builtin',
      preset: DEFAULT_BASEMAP.preset,
      name: DEFAULT_BASEMAP.name,
      attribution: DEFAULT_BASEMAP.attribution,
      sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS, labels: false },
    };
    const style = buildBasemapStyle(config);
    if (typeof style === 'string') throw new Error('Expected style spec, not URL');
    const sourceLayers = new Set(
      style.layers
        .map((layer) => (layer as { 'source-layer'?: string })['source-layer'])
        .filter((value): value is string => Boolean(value)),
    );
    expect(sourceLayers.has('places')).toBe(false);
    expect(sourceLayers.has('pois')).toBe(false);
    expect(sourceLayers.has('roads')).toBe(true);
  });

  it('returns the URL verbatim for a style-url basemap', () => {
    const url = 'https://example.com/style.json';
    expect(
      buildBasemapStyle({ kind: 'style-url', name: 'Custom', url, attribution: '' }),
    ).toBe(url);
  });
});
