import type maplibregl from 'maplibre-gl';
import type { GeoJsonLayer } from '@/project/cartoproj';

const sourceId = (layerId: string) => `gc:${layerId}`;
export const layerRenderIds = (layerId: string) => ({
  fill: `gc:${layerId}:fill`,
  line: `gc:${layerId}:line`,
  circle: `gc:${layerId}:circle`,
});

function addLayerGraphics(map: maplibregl.Map, layer: GeoJsonLayer): void {
  const src = sourceId(layer.id);
  const ids = layerRenderIds(layer.id);
  map.addSource(src, { type: 'geojson', data: layer.data });
  map.addLayer({ id: ids.fill, type: 'fill', source: src });
  map.addLayer({ id: ids.line, type: 'line', source: src });
  map.addLayer({ id: ids.circle, type: 'circle', source: src });
}

function updateLayerGraphics(map: maplibregl.Map, layer: GeoJsonLayer): void {
  const ids = layerRenderIds(layer.id);
  const { style } = layer;
  // Heatmap-strategy layers are drawn by the deck.gl overlay, not MapLibre.
  const visibility = layer.visible && layer.renderStrategy !== 'heatmap' ? 'visible' : 'none';

  map.setPaintProperty(ids.fill, 'fill-color', style.fillColor);
  map.setPaintProperty(ids.fill, 'fill-opacity', style.fillOpacity);
  map.setPaintProperty(ids.line, 'line-color', style.strokeColor);
  map.setPaintProperty(ids.line, 'line-width', style.strokeWidth);
  map.setPaintProperty(ids.circle, 'circle-color', style.pointColor);
  map.setPaintProperty(ids.circle, 'circle-radius', style.pointRadius);
  map.setPaintProperty(ids.circle, 'circle-stroke-color', '#ffffff');
  map.setPaintProperty(ids.circle, 'circle-stroke-width', 1.5);

  for (const id of Object.values(ids)) {
    map.setLayoutProperty(id, 'visibility', visibility);
  }
}

function removeLayerGraphics(map: maplibregl.Map, layerId: string): void {
  for (const id of Object.values(layerRenderIds(layerId))) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(sourceId(layerId))) map.removeSource(sourceId(layerId));
}

/** Reconcile MapLibre sources/layers with the document's GeoJSON layers. */
export function syncLayersToMap(map: maplibregl.Map, layers: GeoJsonLayer[]): void {
  if (!map.isStyleLoaded()) return;

  const wanted = new Set(layers.map((l) => sourceId(l.id)));
  for (const id of Object.keys(map.getStyle().sources ?? {})) {
    if (id.startsWith('gc:') && !wanted.has(id)) {
      removeLayerGraphics(map, id.slice('gc:'.length));
    }
  }

  for (const layer of layers) {
    if (!map.getSource(sourceId(layer.id))) addLayerGraphics(map, layer);
    updateLayerGraphics(map, layer);
  }

  // layers[] is ordered bottom → top; moveLayer with no anchor lifts to the top.
  for (const layer of layers) {
    for (const id of Object.values(layerRenderIds(layer.id))) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}
