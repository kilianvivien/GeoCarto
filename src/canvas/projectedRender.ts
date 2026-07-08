import type { GeoPath, GeoPermissibleObjects } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { computeProportionalDomain, resolveCircleRadius, resolveFillColor } from '@/style/dataStyleEvaluate';

const LAND_FILL = '#e8e6e1';
const LAND_STROKE = '#b8b4ac';

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
      ctx.fillStyle = layer.style.dataStyle?.kind === 'proportional' ? layer.style.dataStyle.color : layer.style.pointColor;
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
    ctx.strokeStyle = layer.style.strokeColor;
    ctx.lineWidth = layer.style.strokeWidth;
    ctx.stroke();
  }
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
): void {
  if (land) drawProjectedLand(ctx, path, land, landStrokeWidth);
  for (const layer of layers) {
    if (!layer.visible || layer.renderStrategy === 'heatmap') continue;
    drawProjectedLayer(ctx, path, layer);
  }
}
