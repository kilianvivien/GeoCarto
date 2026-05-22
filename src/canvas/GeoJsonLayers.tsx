import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { GeoJsonLayer } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useMapInstance } from './mapInstance';

const sourceId = (layerId: string) => `gc:${layerId}`;
const renderIds = (layerId: string) => ({
  fill: `gc:${layerId}:fill`,
  line: `gc:${layerId}:line`,
  circle: `gc:${layerId}:circle`,
});

function addLayerGraphics(map: maplibregl.Map, layer: GeoJsonLayer) {
  const src = sourceId(layer.id);
  const ids = renderIds(layer.id);
  map.addSource(src, { type: 'geojson', data: layer.data });
  map.addLayer({ id: ids.fill, type: 'fill', source: src });
  map.addLayer({ id: ids.line, type: 'line', source: src });
  map.addLayer({ id: ids.circle, type: 'circle', source: src });
}

function updateLayerGraphics(map: maplibregl.Map, layer: GeoJsonLayer) {
  const ids = renderIds(layer.id);
  const { style } = layer;
  const visibility = layer.visible ? 'visible' : 'none';

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

function removeLayerGraphics(map: maplibregl.Map, layerId: string) {
  for (const id of Object.values(renderIds(layerId))) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(sourceId(layerId))) map.removeSource(sourceId(layerId));
}

/** Reconcile MapLibre sources/layers with the document's GeoJSON layers. */
function syncLayers(map: maplibregl.Map, layers: GeoJsonLayer[]) {
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
    for (const id of Object.values(renderIds(layer.id))) {
      if (map.getLayer(id)) map.moveLayer(id);
    }
  }
}

/**
 * Headless renderer: projects the document's imported GeoJSON layers onto the
 * MapLibre map and routes feature clicks to the attribute inspector. Owns no
 * state — it reconciles the map to the document store.
 */
export function GeoJsonLayers() {
  const map = useMapInstance((s) => s.map);
  const layers = useDocumentStore((s) => s.project.layers);
  const selectFeature = useDocumentStore((s) => s.selectFeature);

  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    if (!map) return;
    const apply = () => syncLayers(map, layersRef.current);
    apply();
    // A theme-driven setStyle() wipes custom sources — re-add once it reloads.
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [map, layers]);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const ids = layersRef.current
        .flatMap((l) => Object.values(renderIds(l.id)))
        .filter((id) => map.getLayer(id));
      const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      if (hits.length === 0) {
        selectFeature(null);
        return;
      }
      const hit = hits[0];
      const layerId = hit.layer.id.replace(/^gc:/, '').replace(/:(fill|line|circle)$/, '');
      selectFeature({ layerId, properties: hit.properties ?? {} });
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, selectFeature]);

  return null;
}
