import { describe, expect, it } from 'vitest';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';
import { fillColorExpression } from './syncLayers';

function layer(featureFillColors: Record<string, string> = {}): GeoJsonLayer {
  return {
    id: 'layer-1',
    kind: 'geojson',
    name: 'Layer',
    visible: true,
    locked: false,
    geometry: 'polygon',
    featureCount: 1,
    data: { type: 'FeatureCollection', features: [] },
    style: { ...DEFAULT_GEOJSON_STYLE, fillColor: '#007aff', featureFillColors },
  };
}

describe('fillColorExpression', () => {
  it('uses the layer fill when no feature override exists', () => {
    expect(fillColorExpression(layer())).toBe('#007aff');
  });

  it('matches feature fill overrides by OSM id', () => {
    expect(fillColorExpression(layer({ 'relation/154449': '#34c759' }))).toEqual([
      'match',
      ['to-string', ['get', '@id']],
      'relation/154449',
      '#34c759',
      '#007aff',
    ]);
  });
});
