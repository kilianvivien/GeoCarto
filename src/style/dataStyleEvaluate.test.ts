import { describe, expect, it } from 'vitest';
import type { ChoroplethStyle, GeoJsonLayer, ProportionalStyle } from '@/project/cartoproj';
import { DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';
import { computeProportionalDomain, resolveCircleRadius, resolveFillColor } from './dataStyleEvaluate';

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

describe('resolveFillColor', () => {
  it('uses the layer fill when no feature override exists', () => {
    const feature = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    expect(resolveFillColor(feature, layer())).toBe('#007aff');
  });

  it('matches feature fill overrides by OSM id — agrees with syncLayers.ts fillColorExpression\'s match arm', () => {
    const withOverride = layer({ 'relation/154449': '#34c759' });
    const feature = {
      type: 'Feature' as const,
      properties: { '@id': 'relation/154449' },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    };
    expect(resolveFillColor(feature, withOverride)).toBe('#34c759');
  });

  it('classifies by materialized breaks the same way as the MapLibre step expression', () => {
    // Same fixture as syncLayers.test.ts's "builds a step expression from a
    // choropleth dataStyle" case: breaks [10, 20], ramp 'blues' 3-class ->
    // ['#f7fbff', '#6baed6', '#08306b'].
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

    const below = { type: 'Feature' as const, properties: { pop: 5 }, geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    const mid = { type: 'Feature' as const, properties: { pop: 15 }, geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    const above = { type: 'Feature' as const, properties: { pop: 25 }, geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    const onBreak = { type: 'Feature' as const, properties: { pop: 20 }, geometry: { type: 'Point' as const, coordinates: [0, 0] } };

    expect(resolveFillColor(below, withChoropleth)).toBe('#f7fbff');
    expect(resolveFillColor(mid, withChoropleth)).toBe('#6baed6');
    expect(resolveFillColor(above, withChoropleth)).toBe('#08306b');
    // step semantics: value >= break routes to the upper class, matching syncLayers.ts.
    expect(resolveFillColor(onBreak, withChoropleth)).toBe('#08306b');
  });

  it('routes non-numeric attribute values to missingColor, same as the MapLibre `case` wrapper', () => {
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
    const missing = { type: 'Feature' as const, properties: { pop: 'N/A' }, geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    expect(resolveFillColor(missing, withChoropleth)).toBe('#cccccc');
  });
});

describe('computeProportionalDomain / resolveCircleRadius', () => {
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
    const feature = pointLayer().data.features[0];
    expect(resolveCircleRadius(feature, pointLayer())).toBe(DEFAULT_GEOJSON_STYLE.pointRadius);
  });

  it('sqrt-scales the same way as the interpolate expression over the live attribute domain', () => {
    const dataStyle: ProportionalStyle = {
      kind: 'proportional',
      attribute: 'pop',
      minRadius: 4,
      maxRadius: 20,
      scale: 'sqrt',
      color: '#ff9500',
    };
    const withStyle = pointLayer(dataStyle);
    const domain = computeProportionalDomain(withStyle);
    expect(domain).toEqual({ min: 10, max: 40 });

    // Endpoints must hit minRadius/maxRadius exactly, matching the interpolate stops.
    expect(resolveCircleRadius(withStyle.data.features[0], withStyle, domain)).toBeCloseTo(4, 6);
    expect(resolveCircleRadius(withStyle.data.features[1], withStyle, domain)).toBeCloseTo(20, 6);
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
    expect(resolveCircleRadius(flatLayer.data.features[0], flatLayer)).toBe(12);
  });

  it('routes non-numeric attribute values to a hidden (0) radius, same as the MapLibre case wrapper', () => {
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
    const missingFeature = mixedLayer.data.features[1];
    expect(resolveCircleRadius(missingFeature, mixedLayer)).toBe(0);
  });
});
