import type maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import type { FeatureFillStyle, GeoJsonLayer } from '@/project/cartoproj';
import type { SelectedFeature } from '@/state/documentStore';
import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';
import { hatchTileImageData } from '@/style/annotationPatterns';
import { coerceNumber, scanAttribute } from '@/style/classify';
import { sampleRamp } from '@/style/ramps';

const sourceId = (layerId: string) => `gc:${layerId}`;

/**
 * Tracks the `FeatureCollection` last pushed to each MapLibre source so we can
 * `setData` when a layer's geometry changes (e.g. vector edits, undo/redo).
 * Without this the source keeps its first-loaded geometry forever — edits commit
 * to the document but never reach the map. Reference identity is enough: the
 * document store produces a new collection only when the data actually changed.
 */
const lastSourceData = new Map<string, FeatureCollection>();
export const layerRenderIds = (layerId: string) => ({
  fill: `gc:${layerId}:fill`,
  pattern: `gc:${layerId}:pattern`,
  line: `gc:${layerId}:line`,
  circle: `gc:${layerId}:circle`,
  selectedFill: `gc:${layerId}:selected-fill`,
  selectedLine: `gc:${layerId}:selected-line`,
});

export function layerIdFromRenderId(renderId: string): string {
  return renderId.replace(/^gc:/, '').replace(/:(fill|pattern|line|circle|selected-fill|selected-line)$/, '');
}

function selectedFeatureFilter(
  layer: GeoJsonLayer,
  selectedFeature: SelectedFeature | null,
): maplibregl.ExpressionSpecification {
  if (!selectedFeature?.fillKey || selectedFeature.layerId !== layer.id) {
    return ['==', ['get', FEATURE_FILL_PROPERTY], '__none__'];
  }
  return ['==', ['to-string', ['get', FEATURE_FILL_PROPERTY]], selectedFeature.fillKey];
}

function addLayerGraphics(map: maplibregl.Map, layer: GeoJsonLayer): void {
  const src = sourceId(layer.id);
  const ids = layerRenderIds(layer.id);
  map.addSource(src, { type: 'geojson', data: layer.data });
  lastSourceData.set(layer.id, layer.data);
  map.addLayer({
    id: ids.fill,
    type: 'fill',
    source: src,
    filter: ['==', ['geometry-type'], 'Polygon'],
  });
  map.addLayer({
    id: ids.line,
    type: 'line',
    source: src,
    filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'LineString']],
  });
  map.addLayer({
    id: ids.pattern,
    type: 'fill',
    source: src,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['to-string', ['get', FEATURE_FILL_PROPERTY]], ['literal', []]]],
  });
  map.addLayer({
    id: ids.circle,
    type: 'circle',
    source: src,
    filter: ['==', ['geometry-type'], 'Point'],
  });
  map.addLayer({
    id: ids.selectedFill,
    type: 'fill',
    source: src,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', FEATURE_FILL_PROPERTY], '__none__']],
  });
  map.addLayer({
    id: ids.selectedLine,
    type: 'line',
    source: src,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', FEATURE_FILL_PROPERTY], '__none__']],
  });
}

/**
 * Exact `@id` set of features whose attribute doesn't coerce to a finite
 * number — computed with the same rule as `scanAttribute`/`missingCount` so
 * the rendered "missing" color always agrees with the UI/legend. A MapLibre
 * `to-number(x, 0)` fallback alone isn't enough: it silently coerces
 * non-numeric strings (e.g. "N/A") to 0, which would misclassify them into
 * the lowest step instead of routing them to `missingColor`.
 */
function missingFeatureIds(features: Feature[], attribute: string): string[] {
  const ids: string[] = [];
  for (const feature of features) {
    if (coerceNumber(feature.properties?.[attribute]) !== null) continue;
    const key = feature.properties?.[FEATURE_FILL_PROPERTY];
    if (typeof key === 'string') ids.push(key);
  }
  return ids;
}

/** True when a feature is in the precomputed missing-attribute set. */
function attributeMissingExpression(missingIds: string[]): unknown {
  if (missingIds.length === 0) return false;
  return ['in', ['to-string', ['get', FEATURE_FILL_PROPERTY]], ['literal', missingIds]];
}

/** Data-driven `fill-color` for a choropleth: a `step` expression over materialized breaks. */
export function choroplethFillColorExpression(
  features: Feature[],
  attribute: string,
  breaks: number[],
  colors: string[],
  missingColor: string,
): unknown[] {
  const valueExpr = ['to-number', ['get', attribute], 0];
  const stepArgs: unknown[] = ['step', valueExpr, colors[0]];
  for (let i = 0; i < breaks.length; i++) {
    stepArgs.push(breaks[i], colors[i + 1]);
  }
  return ['case', attributeMissingExpression(missingFeatureIds(features, attribute)), missingColor, stepArgs];
}

export function fillColorExpression(layer: GeoJsonLayer): string | unknown[] {
  const dataStyle = layer.style.dataStyle;
  if (dataStyle?.kind === 'choropleth') {
    const colors = sampleRamp(dataStyle.paletteId, dataStyle.breaks.length + 1, dataStyle.reverse);
    return choroplethFillColorExpression(layer.data.features, dataStyle.attribute, dataStyle.breaks, colors, dataStyle.missingColor);
  }
  const overrides = featureStyleEntries(layer).map(([key, style]) => [key, style.fillColor]);
  if (overrides.length === 0) return layer.style.fillColor;
  return [
    'match',
    ['to-string', ['get', FEATURE_FILL_PROPERTY]],
    ...overrides.flatMap(([key, color]) => [key, color]),
    layer.style.fillColor,
  ];
}

/** Data-driven `circle-radius` for proportional symbols: an `interpolate` expression over the attribute's live domain. */
export function proportionalRadiusExpression(layer: GeoJsonLayer): number | unknown[] {
  const dataStyle = layer.style.dataStyle;
  if (dataStyle?.kind !== 'proportional') return layer.style.pointRadius;
  const { attribute, minRadius, maxRadius, scale } = dataStyle;
  const stats = scanAttribute(layer.data.features, attribute);
  if (stats.values.length === 0) return layer.style.pointRadius;

  const dataMin = Math.max(0, stats.values[0]);
  const dataMax = Math.max(0, stats.values[stats.values.length - 1]);
  const rawExpr = ['to-number', ['get', attribute], 0];
  const missing: unknown = attributeMissingExpression(missingFeatureIds(layer.data.features, attribute));

  if (dataMin >= dataMax) {
    // Degenerate (single-value or zero-span) domain — a ramp needs two distinct
    // stops, so fall back to a constant radius rather than dividing by zero.
    const flat = (minRadius + maxRadius) / 2;
    return ['case', missing, 0, flat];
  }

  if (scale === 'sqrt') {
    const domainExpr = ['sqrt', ['max', 0, rawExpr]];
    return ['case', missing, 0, ['interpolate', ['linear'], domainExpr, Math.sqrt(dataMin), minRadius, Math.sqrt(dataMax), maxRadius]];
  }
  return ['case', missing, 0, ['interpolate', ['linear'], rawExpr, dataMin, minRadius, dataMax, maxRadius]];
}

function featureStyleEntries(layer: GeoJsonLayer): [string, FeatureFillStyle][] {
  const merged = new Map<string, FeatureFillStyle>();
  for (const [key, color] of Object.entries(layer.style.featureFillColors ?? {})) {
    merged.set(key, {
      fillColor: color,
      fillPattern: layer.style.fillPattern,
      hatchColor: layer.style.hatchColor,
      hatchSpacing: layer.style.hatchSpacing,
    });
  }
  for (const [key, style] of Object.entries(layer.style.featureFillStyles ?? {})) merged.set(key, style);
  return [...merged.entries()];
}

function updateLayerGraphics(
  map: maplibregl.Map,
  layer: GeoJsonLayer,
  selectedFeature: SelectedFeature | null,
  editingLayerId: string | null,
): void {
  const ids = layerRenderIds(layer.id);
  const { style } = layer;
  // While a layer is open in the vector editor, terra-draw owns its visual — hide
  // the canonical MapLibre render so the two don't draw on top of each other.
  const editing = editingLayerId === layer.id;
  // Heatmap-strategy layers are drawn by the deck.gl overlay, not MapLibre.
  const visibility =
    !editing && layer.visible && layer.renderStrategy !== 'heatmap' ? 'visible' : 'none';
  const selectedFilter = selectedFeatureFilter(layer, selectedFeature);

  map.setPaintProperty(ids.fill, 'fill-color', fillColorExpression(layer));
  map.setPaintProperty(ids.fill, 'fill-opacity', style.fillOpacity);
  applyFillPattern(map, layer);
  applyFeatureFillPatterns(map, layer);
  map.setPaintProperty(ids.line, 'line-color', style.strokeColor);
  map.setPaintProperty(ids.line, 'line-width', style.strokeWidth);
  map.setPaintProperty(
    ids.circle,
    'circle-color',
    style.dataStyle?.kind === 'proportional' ? style.dataStyle.color : style.pointColor,
  );
  map.setPaintProperty(ids.circle, 'circle-radius', proportionalRadiusExpression(layer));
  map.setPaintProperty(ids.circle, 'circle-stroke-color', '#ffffff');
  map.setPaintProperty(ids.circle, 'circle-stroke-width', 1.5);
  map.setFilter(ids.selectedFill, ['all', ['==', ['geometry-type'], 'Polygon'], selectedFilter]);
  map.setPaintProperty(ids.selectedFill, 'fill-color', '#ffcc00');
  map.setPaintProperty(ids.selectedFill, 'fill-opacity', 0.22);
  map.setFilter(ids.selectedLine, ['all', ['==', ['geometry-type'], 'Polygon'], selectedFilter]);
  map.setPaintProperty(ids.selectedLine, 'line-color', '#ffcc00');
  map.setPaintProperty(ids.selectedLine, 'line-width', Math.max(3, style.strokeWidth + 2));
  map.setPaintProperty(ids.selectedLine, 'line-opacity', 0.95);

  map.setLayoutProperty(ids.fill, 'visibility', visibility);
  map.setLayoutProperty(ids.pattern, 'visibility', visibility);
  map.setLayoutProperty(ids.line, 'visibility', visibility);
  map.setLayoutProperty(ids.circle, 'visibility', style.showPoints ? visibility : 'none');
  map.setLayoutProperty(ids.selectedFill, 'visibility', visibility);
  map.setLayoutProperty(ids.selectedLine, 'visibility', visibility);
}

const hatchImageId = (layerId: string) => `gc-hatch:${layerId}`;

/**
 * Apply (or clear) a `fill-pattern` hatch on the fill layer. The tile is
 * regenerated each sync so colour/spacing edits take effect; when the pattern is
 * solid we drop the pattern so `fill-color` shows through.
 */
function applyFillPattern(map: maplibregl.Map, layer: GeoJsonLayer): void {
  const fillId = layerRenderIds(layer.id).fill;
  const imageId = hatchImageId(layer.id);
  // Clear first so we never remove an image still referenced by the layer.
  map.setPaintProperty(fillId, 'fill-pattern', undefined);
  const featureImagePrefix = `${imageId}:feature:`;
  for (const id of map.listImages()) {
    if ((id === imageId || id.startsWith(featureImagePrefix)) && map.hasImage(id)) map.removeImage(id);
  }

  // Choropleth fill is fully data-driven — hatch patterns don't compose with it in v1.
  if (layer.renderStrategy === 'heatmap' || layer.style.fillPattern === 'none' || layer.style.dataStyle?.kind === 'choropleth') return;
  const tile = hatchTileImageData(layer.style);
  if (!tile) return;
  map.addImage(imageId, tile, { pixelRatio: 1 });
  map.setPaintProperty(fillId, 'fill-pattern', imageId);
}

function applyFeatureFillPatterns(map: maplibregl.Map, layer: GeoJsonLayer): void {
  const patternId = layerRenderIds(layer.id).pattern;
  const imagePrefix = `${hatchImageId(layer.id)}:feature:`;
  const overrides = featureStyleEntries(layer).filter(([, style]) => style.fillPattern !== 'none');
  map.setPaintProperty(patternId, 'fill-pattern', undefined);
  map.setFilter(patternId, ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['to-string', ['get', FEATURE_FILL_PROPERTY]], ['literal', []]]]);
  // Choropleth fill supersedes per-feature overrides in v1 — the two modes are mutually exclusive.
  if (overrides.length === 0 || layer.style.dataStyle?.kind === 'choropleth') return;

  const expression: unknown[] = ['match', ['to-string', ['get', FEATURE_FILL_PROPERTY]]];
  const keys: string[] = [];
  for (const [key, style] of overrides) {
    const tile = hatchTileImageData(style);
    if (!tile) continue;
    const imageId = `${imagePrefix}${key}`;
    map.addImage(imageId, tile, { pixelRatio: 1 });
    expression.push(key, imageId);
    keys.push(key);
  }
  expression.push(`${imagePrefix}fallback`);
  if (keys.length === 0) return;
  map.setFilter(patternId, [
    'all',
    ['==', ['geometry-type'], 'Polygon'],
    ['in', ['to-string', ['get', FEATURE_FILL_PROPERTY]], ['literal', keys]],
  ]);
  map.setPaintProperty(patternId, 'fill-pattern', expression);
  map.setPaintProperty(patternId, 'fill-opacity', layer.style.fillOpacity);
}

function removeLayerGraphics(map: maplibregl.Map, layerId: string): void {
  if (map.hasImage(hatchImageId(layerId))) map.removeImage(hatchImageId(layerId));
  for (const id of Object.values(layerRenderIds(layerId))) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(sourceId(layerId))) map.removeSource(sourceId(layerId));
  lastSourceData.delete(layerId);
}

/** Reconcile MapLibre sources/layers with the document's GeoJSON layers. */
export function syncLayersToMap(
  map: maplibregl.Map,
  layers: GeoJsonLayer[],
  selectedFeature: SelectedFeature | null = null,
  editingLayerId: string | null = null,
): void {
  if (!map.isStyleLoaded()) return;

  const wanted = new Set(layers.map((l) => sourceId(l.id)));
  for (const id of Object.keys(map.getStyle().sources ?? {})) {
    if (id.startsWith('gc:') && !wanted.has(id)) {
      removeLayerGraphics(map, id.slice('gc:'.length));
    }
  }

  for (const layer of layers) {
    // Heatmap-strategy layers are drawn by the deck.gl overlay, never MapLibre.
    // Skip loading them as a MapLibre source entirely so their (often large)
    // geometry isn't tessellated a second time — which is what triggers
    // MapLibre's "Max vertices per segment is 65535" warning for big datasets.
    if (layer.renderStrategy === 'heatmap') {
      if (map.getSource(sourceId(layer.id))) removeLayerGraphics(map, layer.id);
      continue;
    }
    if (
      map.getSource(sourceId(layer.id)) &&
      Object.values(layerRenderIds(layer.id)).some((id) => !map.getLayer(id))
    ) {
      removeLayerGraphics(map, layer.id);
    }
    if (!map.getSource(sourceId(layer.id))) {
      addLayerGraphics(map, layer);
    } else if (lastSourceData.get(layer.id) !== layer.data) {
      // Geometry changed in the document (vector edit, undo/redo) — refresh it.
      (map.getSource(sourceId(layer.id)) as maplibregl.GeoJSONSource).setData(layer.data);
      lastSourceData.set(layer.id, layer.data);
    }
    updateLayerGraphics(map, layer, selectedFeature, editingLayerId);
  }

  // layers[] is ordered bottom → top; moveLayer with no anchor lifts to the top.
  for (const layer of layers) {
    for (const id of Object.values(layerRenderIds(layer.id))) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}
