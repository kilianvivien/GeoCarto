import type { Feature } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';
import { coerceNumber, scanAttribute } from './classify';
import { sampleRamp } from './ramps';

/**
 * Scalar (per-feature) equivalents of `syncLayers.ts`'s MapLibre expression
 * builders (`fillColorExpression` / `proportionalRadiusExpression`), for the
 * Canvas2D projected-engine render path where there's no GPU expression
 * evaluator — each feature is drawn one at a time via `d3.geoPath`. Built on
 * the same pure primitives (`classify.ts`, `ramps.ts`) so the two render
 * backends can't silently diverge; see `dataStyleEvaluate.test.ts` for the
 * cross-check against `syncLayers.test.ts`'s expression fixtures.
 */

function featureKey(feature: Feature): string | undefined {
  const key = feature.properties?.[FEATURE_FILL_PROPERTY];
  return typeof key === 'string' ? key : undefined;
}

/** Resolve a feature's fill color for a layer, honoring choropleth `dataStyle` or flat/per-feature overrides. */
export function resolveFillColor(feature: Feature, layer: GeoJsonLayer): string {
  const { style } = layer;
  const dataStyle = style.dataStyle;
  if (dataStyle?.kind === 'choropleth') {
    const value = coerceNumber(feature.properties?.[dataStyle.attribute]);
    if (value === null) return dataStyle.missingColor;
    const colors = sampleRamp(dataStyle.paletteId, dataStyle.breaks.length + 1, dataStyle.reverse);
    let classIndex = 0;
    for (const brk of dataStyle.breaks) {
      if (value >= brk) classIndex++;
      else break;
    }
    return colors[classIndex];
  }
  const key = featureKey(feature);
  if (key) {
    const overrideStyle = style.featureFillStyles[key]?.fillColor;
    if (overrideStyle) return overrideStyle;
    const overrideColor = style.featureFillColors[key];
    if (overrideColor) return overrideColor;
  }
  return style.fillColor;
}

export interface ProportionalDomain {
  min: number;
  max: number;
}

/** Precompute a proportional-symbol layer's attribute domain once per render pass (avoids O(n²) rescans). */
export function computeProportionalDomain(layer: GeoJsonLayer): ProportionalDomain | null {
  const dataStyle = layer.style.dataStyle;
  if (dataStyle?.kind !== 'proportional') return null;
  const stats = scanAttribute(layer.data.features, dataStyle.attribute);
  if (stats.values.length === 0) return null;
  return { min: Math.max(0, stats.values[0]), max: Math.max(0, stats.values[stats.values.length - 1]) };
}

/** Resolve a feature's circle radius for a layer, honoring proportional-symbol `dataStyle`. */
export function resolveCircleRadius(feature: Feature, layer: GeoJsonLayer, domain?: ProportionalDomain | null): number {
  const { style } = layer;
  const dataStyle = style.dataStyle;
  if (dataStyle?.kind !== 'proportional') return style.pointRadius;

  const value = coerceNumber(feature.properties?.[dataStyle.attribute]);
  if (value === null) return 0;

  const resolvedDomain = domain !== undefined ? domain : computeProportionalDomain(layer);
  if (!resolvedDomain) return style.pointRadius;
  const { min: dataMin, max: dataMax } = resolvedDomain;
  const { minRadius, maxRadius, scale } = dataStyle;

  if (dataMin >= dataMax) return (minRadius + maxRadius) / 2;

  const raw = Math.max(0, value);
  if (scale === 'sqrt') {
    const domainMin = Math.sqrt(dataMin);
    const domainMax = Math.sqrt(dataMax);
    const t = (Math.sqrt(raw) - domainMin) / (domainMax - domainMin);
    return minRadius + t * (maxRadius - minRadius);
  }
  const t = (raw - dataMin) / (dataMax - dataMin);
  return minRadius + t * (maxRadius - minRadius);
}
