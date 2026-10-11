import type { GeoPath, GeoPermissibleObjects } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import {
  computeProportionalDomain,
  resolveCircleRadius,
  resolveFillColor,
  resolveLineColor,
  resolvePointColor,
} from '@/style/dataStyleEvaluate';
import { LABEL_FONT_FAMILY, LABEL_HALO_COLOR, LABEL_HALO_RATIO, LABEL_LINE_HEIGHT, layerLabels } from '@/style/labels';

const LAND_FILL = '#e8e6e1';
const LAND_STROKE = '#b8b4ac';
const COUNTRY_STROKE = 'rgba(104, 101, 94, 0.55)';

/**
 * Draws one GeoJSON layer's features onto a Canvas2D context via a `d3.geoPath`,
 * honoring flat `GeoJsonStyle` and (via `dataStyleEvaluate`) choropleth/
 * proportional-symbol `dataStyle`. Shared by the live `ProjectedMapView` and
 * the raster/SVG export paths so the projected engine has one render routine,
 * not a duplicated live/export pair.
 */
export function drawProjectedLayer(ctx: CanvasRenderingContext2D, path: GeoPath, layer: GeoJsonLayer): void {
  const domain = computeProportionalDomain(layer);
  for (const feature of layer.data.features as Feature[]) {
    const type = feature.geometry?.type;
    if (!type) continue;

    if (type === 'Point' || type === 'MultiPoint') {
      if (!layer.style.showPoints) continue;
      const radius = resolveCircleRadius(feature, layer, domain);
      if (radius <= 0) continue;
      path.pointRadius(radius);
      ctx.beginPath();
      path(feature as GeoPermissibleObjects);
      ctx.fillStyle = resolvePointColor(feature, layer);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      continue;
    }

    ctx.beginPath();
    path(feature as GeoPermissibleObjects);
    if (type === 'Polygon' || type === 'MultiPolygon') {
      ctx.globalAlpha = layer.style.fillOpacity;
      ctx.fillStyle = resolveFillColor(feature, layer);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = resolveLineColor(feature, layer);
    ctx.lineWidth = layer.style.strokeWidth;
    ctx.stroke();
  }
}

/**
 * Draws a layer's attribute labels. Every label is drawn — the projected
 * engine has no collision pass — at the anchors `layerLabels` computes, so the
 * canvas matches the vector export exactly. `sizeScale` converts editor pixels
 * to output pixels for high-resolution exports.
 */
export function drawProjectedLabels(
  ctx: CanvasRenderingContext2D,
  path: GeoPath,
  layer: GeoJsonLayer,
  sizeScale = 1,
): void {
  const style = layer.style.labels;
  const project = path.projection() as ((point: [number, number]) => [number, number] | null) | null;
  if (!style || !project) return;
  const size = style.size * sizeScale;
  ctx.save();
  ctx.font = `${size}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = style.color;
  ctx.strokeStyle = LABEL_HALO_COLOR;
  ctx.lineWidth = size * LABEL_HALO_RATIO * 2;
  for (const label of layerLabels(layer)) {
    const point = project(label.position);
    if (!point) continue;
    const lineHeight = size * LABEL_LINE_HEIGHT;
    // Centered block for lines/polygons; hung below the symbol for points.
    const top =
      label.offset > 0
        ? point[1] + label.offset * sizeScale
        : point[1] - (label.lines.length * lineHeight) / 2;
    label.lines.forEach((line, index) => {
      const y = top + lineHeight * (index + 0.5);
      if (style.halo) ctx.strokeText(line, point[0], y);
      ctx.fillText(line, point[0], y);
    });
  }
  ctx.restore();
}

/** Draws bundled Natural Earth land outlines beneath the layers. */
export function drawProjectedLand(
  ctx: CanvasRenderingContext2D,
  path: GeoPath,
  land: FeatureCollection<Geometry>,
  strokeWidth = 0.75,
): void {
  ctx.beginPath();
  path(land as GeoPermissibleObjects);
  ctx.fillStyle = LAND_FILL;
  ctx.fill();
  ctx.strokeStyle = LAND_STROKE;
  ctx.lineWidth = strokeWidth;
  ctx.stroke();
}

/** Draws the full projected scene (land + visible vector layers) onto a Canvas2D context. */
export function drawProjectedScene(
  ctx: CanvasRenderingContext2D,
  path: GeoPath,
  land: FeatureCollection<Geometry> | null,
  layers: GeoJsonLayer[],
  landStrokeWidth = 0.75,
  countries: FeatureCollection<Geometry> | null = null,
  sizeScale = 1,
): void {
  if (land) drawProjectedLand(ctx, path, land, landStrokeWidth);
  if (countries) {
    ctx.beginPath();
    path(countries as GeoPermissibleObjects);
    ctx.strokeStyle = COUNTRY_STROKE;
    ctx.lineWidth = Math.max(0.45, landStrokeWidth * 0.75);
    ctx.stroke();
  }
  for (const layer of layers) {
    if (!layer.visible || layer.renderStrategy === 'heatmap') continue;
    drawProjectedLayer(ctx, path, layer);
  }
  // Labels go last so no layer's fill covers another layer's text.
  for (const layer of layers) {
    if (layer.visible) drawProjectedLabels(ctx, path, layer, sizeScale);
  }
}
