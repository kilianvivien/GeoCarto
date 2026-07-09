import { describe, expect, it } from 'vitest';
import type { ChoroplethStyle, GeoJsonLayer, ProportionalStyle } from '@/project/cartoproj';
import { DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';
import { choroplethFillColorExpression, fillColorExpression, proportionalRadiusExpression } from './syncLayers';

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

  it('builds a step expression from a choropleth dataStyle, ignoring feature overrides', () => {
    const choropleth: ChoroplethStyle = {
      kind: 'choropleth',
      attribute: 'pop',
      method: 'equal',
      classCount: 3,
      breaks: [10, 20],
      paletteId: 'blues',
      reverse: false,
      missingColor: '#cccccc',
    };
    const withChoropleth = layer({ 'relation/154449': '#34c759' });
    withChoropleth.style.dataStyle = choropleth;
    const expression = fillColorExpression(withChoropleth);
    expect(expression).toEqual([
      'case',
      false,
      '#cccccc',
      ['step', ['to-number', ['get', 'pop'], 0], '#f7fbff', 10, '#6baed6', 20, '#08306b'],
    ]);
  });

  it('routes non-numeric attribute values to missingColor instead of the lowest step', () => {
    const choropleth: ChoroplethStyle = {
      kind: 'choropleth',
      attribute: 'pop',
      method: 'equal',
      classCount: 3,
      breaks: [10, 20],
      paletteId: 'blues',
      reverse: false,
      missingColor: '#cccccc',
    };
    const withChoropleth = layer();
    withChoropleth.style.dataStyle = choropleth;
    withChoropleth.data.features = [
      { type: 'Feature', id: 'a', properties: { '@id': 'a', pop: 5 }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', id: 'b', properties: { '@id': 'b', pop: 'N/A' }, geometry: { type: 'Point', coordinates: [0, 0] } },
    ];
    const expression = fillColorExpression(withChoropleth);
    expect(expression).toEqual([
      'case',
      ['in', ['to-string', ['get', '@id']], ['literal', ['b']]],
      '#cccccc',
      ['step', ['to-number', ['get', 'pop'], 0], '#f7fbff', 10, '#6baed6', 20, '#08306b'],
    ]);
  });
});

describe('choroplethFillColorExpression', () => {
  it('handles a degenerate single-class case with no breaks', () => {
    const expression = choroplethFillColorExpression([], 'pop', [], ['#f7fbff'], '#cccccc');
    expect(expression).toEqual(['case', false, '#cccccc', ['step', ['to-number', ['get', 'pop'], 0], '#f7fbff']]);
  });
});

describe('proportionalRadiusExpression', () => {
  function pointLayer(dataStyle?: ProportionalStyle): GeoJsonLayer {
    return {
      id: 'layer-2',
      kind: 'geojson',
      name: 'Cities',
      visible: true,
      locked: false,
      geometry: 'point',
      featureCount: 2,
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { pop: 10 }, geometry: { type: 'Point', coordinates: [0, 0] } },
          { type: 'Feature', properties: { pop: 40 }, geometry: { type: 'Point', coordinates: [1, 1] } },
        ],
      },
      style: { ...DEFAULT_GEOJSON_STYLE, dataStyle },
    };
  }

  it('falls back to the flat point radius when no proportional dataStyle is set', () => {
    expect(proportionalRadiusExpression(pointLayer())).toBe(DEFAULT_GEOJSON_STYLE.pointRadius);
  });

  it('builds a sqrt-scaled interpolate expression over the live attribute domain', () => {
    const dataStyle: ProportionalStyle = {
      kind: 'proportional',
      attribute: 'pop',
      minRadius: 4,
      maxRadius: 20,
      scale: 'sqrt',
      color: '#ff9500',
    };
    const expression = proportionalRadiusExpression(pointLayer(dataStyle));
    expect(expression).toEqual([
      'case',
      false,
      0,
      [
        'interpolate',
        ['linear'],
        ['sqrt', ['max', 0, ['to-number', ['get', 'pop'], 0]]],
        Math.sqrt(10),
        4,
        Math.sqrt(40),
        20,
      ],
    ]);
  });

  it('falls back to a flat radius when the attribute has no spread', () => {
    const dataStyle: ProportionalStyle = {
      kind: 'proportional',
      attribute: 'flat',
      minRadius: 4,
      maxRadius: 20,
      scale: 'linear',
      color: '#ff9500',
    };
    const flatLayer = pointLayer(dataStyle);
    flatLayer.data.features.forEach((f) => (f.properties = { flat: 5 }));
    expect(proportionalRadiusExpression(flatLayer)).toEqual(['case', false, 0, 12]);
  });

  it('routes non-numeric attribute values to a hidden (0) radius instead of coercing to 0-value data', () => {
    const dataStyle: ProportionalStyle = {
      kind: 'proportional',
      attribute: 'pop',
      minRadius: 4,
      maxRadius: 20,
      scale: 'linear',
      color: '#ff9500',
    };
    const mixedLayer = pointLayer(dataStyle);
    mixedLayer.data.features = [
      { type: 'Feature', properties: { '@id': 'a', pop: 10 }, geometry: { type: 'Point', coordinates: [0, 0] } },
      { type: 'Feature', properties: { '@id': 'b', pop: 'unknown' }, geometry: { type: 'Point', coordinates: [1, 1] } },
      { type: 'Feature', properties: { '@id': 'c', pop: 40 }, geometry: { type: 'Point', coordinates: [1, 1] } },
    ];
    const expression = proportionalRadiusExpression(mixedLayer);
    expect(expression).toEqual([
      'case',
      ['in', ['to-string', ['get', '@id']], ['literal', ['b']]],
      0,
      ['interpolate', ['linear'], ['to-number', ['get', 'pop'], 0], 10, 4, 40, 20],
    ]);
  });
});
