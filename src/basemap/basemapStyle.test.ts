import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import {
  DEFAULT_BASEMAP,
  DEFAULT_BASEMAP_SUBLAYERS,
  type BasemapConfig,
} from '@/project/cartoproj';
import { applySublayerVisibility, buildBasemapStyle, DEFAULT_PMTILES_URL } from './basemapStyle';

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

  it('can hide granular Protomaps source-layer groups', () => {
    const out = applySublayerVisibility(layers, {
      ...DEFAULT_BASEMAP_SUBLAYERS,
      earth: false,
      places: false,
      pois: false,
      landcover: false,
    });
    expect(out.find((layer) => layer.id === 'earth')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'places-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'pois-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'landcover-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'landuse-1')).toBeDefined();
  });

  it('keeps legacy labels aggregate support for saved projects', () => {
    const out = applySublayerVisibility(layers, {
      ...DEFAULT_BASEMAP_SUBLAYERS,
      labels: false,
    });
    expect(out.find((layer) => layer.id === 'places-1')).toBeUndefined();
    expect(out.find((layer) => layer.id === 'pois-1')).toBeUndefined();
  });

  it('can hide every Protomaps source-layer group', () => {
    const out = applySublayerVisibility(layers, {
      earth: false,
      roads: false,
      labels: false,
      places: false,
      pois: false,
      water: false,
      landcover: false,
      landuse: false,
      buildings: false,
      boundaries: false,
    });
    expect(out).toHaveLength(0);
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

  it('uses the shared public PMTiles endpoint for built-in basemaps', () => {
    const style = buildBasemapStyle(DEFAULT_BASEMAP);
    if (typeof style === 'string') throw new Error('Expected style spec, not URL');
    const source = style.sources.protomaps;
    if (!source || source.type !== 'vector') throw new Error('Expected vector source');
    expect(source.url).toBe(`pmtiles://${DEFAULT_PMTILES_URL}`);
  });

  it('returns the URL verbatim for a style-url basemap', () => {
    const url = 'https://example.com/style.json';
    expect(
      buildBasemapStyle({ kind: 'style-url', name: 'Custom', url, attribution: '' }),
    ).toBe(url);
  });

  it('parses inline style JSON for a style-json basemap', () => {
    const spec = JSON.stringify({
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff' } }],
    });
    const result = buildBasemapStyle({
      kind: 'style-json',
      name: 'Inline',
      styleJson: spec,
      attribution: '',
    });
    if (typeof result === 'string') throw new Error('Expected parsed style, not URL');
    expect(result.version).toBe(8);
    expect(result.layers[0].id).toBe('background');
  });

  it('returns a transparent blank style for an empty basemap', () => {
    const result = buildBasemapStyle({ kind: 'empty', name: 'Empty', attribution: '' });
    if (typeof result === 'string') throw new Error('Expected style spec, not URL');
    expect(result.sources).toEqual({});
    expect(result.layers).toEqual([
      { id: 'background', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } },
    ]);
  });

  it('falls back to a blank style for desktop-only local PMTiles in the web build', () => {
    const result = buildBasemapStyle({
      kind: 'pmtiles-file',
      name: 'Local archive',
      path: '/Users/example/local.pmtiles',
      preset: 'editorial-light',
      attribution: 'Local archive',
      sublayers: DEFAULT_BASEMAP_SUBLAYERS,
    });
    if (typeof result === 'string') throw new Error('Expected style spec, not URL');
    expect(result.sources).toEqual({});
  });
});
