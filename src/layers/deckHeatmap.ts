import type { Position } from 'geojson';
import type maplibregl from 'maplibre-gl';
import type { GeoJsonLayer } from '@/project/cartoproj';

/** Layers the user has flipped to the heatmap render strategy. */
export function heatmapLayers(layers: GeoJsonLayer[]): GeoJsonLayer[] {
  return layers.filter((layer) => layer.visible && layer.renderStrategy === 'heatmap');
}

interface HeatPoint {
  position: [number, number];
}

/** Flatten every coordinate in a geometry into weighted heatmap points. */
function collectPositions(coordinates: unknown, out: HeatPoint[]): void {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    out.push({ position: [coordinates[0], coordinates[1]] });
    return;
  }
  for (const child of coordinates) collectPositions(child, out);
}

function pointsFor(layer: GeoJsonLayer): HeatPoint[] {
  const out: HeatPoint[] = [];
  for (const feature of layer.data.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'GeometryCollection') {
      for (const sub of geometry.geometries) {
        collectPositions((sub as { coordinates?: Position }).coordinates, out);
      }
    } else {
      collectPositions((geometry as { coordinates?: Position }).coordinates, out);
    }
  }
  return out;
}

/**
 * Build deck.gl HeatmapLayer instances for the document's heatmap layers. The
 * deck modules are imported lazily by the caller; this stays type-only-import
 * free so it can run in either context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildHeatmapDeckLayers(layers: GeoJsonLayer[]): Promise<any[]> {
  const wanted = heatmapLayers(layers);
  if (wanted.length === 0) return [];
  const { HeatmapLayer } = await import('@deck.gl/aggregation-layers');
  return wanted.map(
    (layer) =>
      new HeatmapLayer<HeatPoint>({
        id: `gc-heat:${layer.id}`,
        data: pointsFor(layer),
        getPosition: (d) => d.position,
        getWeight: 1,
        radiusPixels: Math.max(20, layer.style.pointRadius * 6),
        opacity: 0.85,
      }),
  );
}

/**
 * Attach (or refresh) a deck.gl MapboxOverlay carrying the heatmap layers onto a
 * map, interleaved with the basemap so z-order and the WebGL context are shared.
 * Returns the overlay so callers can remove it, or null if nothing to draw.
 */
export async function attachHeatmapOverlay(
  map: maplibregl.Map,
  layers: GeoJsonLayer[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existing?: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const deckLayers = await buildHeatmapDeckLayers(layers);
  if (deckLayers.length === 0) {
    if (existing) map.removeControl(existing);
    return null;
  }
  if (existing) {
    existing.setProps({ layers: deckLayers });
    return existing;
  }
  const { MapboxOverlay } = await import('@deck.gl/mapbox');
  const overlay = new MapboxOverlay({ interleaved: true, layers: deckLayers });
  // maplibre's IControl shape matches MapboxOverlay; the cast bridges the types.
  map.addControl(overlay as unknown as maplibregl.IControl);
  return overlay;
}
