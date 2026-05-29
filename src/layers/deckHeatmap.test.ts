import { describe, expect, it } from 'vitest';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';
import { heatmapLayers } from './deckHeatmap';

function layer(over: Partial<GeoJsonLayer>): GeoJsonLayer {
  return {
    id: over.id ?? 'l',
    kind: 'geojson',
    name: 'L',
    visible: true,
    locked: false,
    geometry: 'point',
    featureCount: 0,
    data: { type: 'FeatureCollection', features: [] },
    style: { ...DEFAULT_GEOJSON_STYLE },
    ...over,
  };
}

describe('heatmapLayers', () => {
  it('selects only visible layers with the heatmap strategy', () => {
    const layers = [
      layer({ id: 'a', renderStrategy: 'heatmap' }),
      layer({ id: 'b', renderStrategy: 'vector' }),
      layer({ id: 'c' }), // undefined → vector default
      layer({ id: 'd', renderStrategy: 'heatmap', visible: false }),
    ];
    expect(heatmapLayers(layers).map((l) => l.id)).toEqual(['a']);
  });

  it('returns empty when nothing uses heatmap', () => {
    expect(heatmapLayers([layer({ renderStrategy: 'vector' })])).toEqual([]);
  });
});
