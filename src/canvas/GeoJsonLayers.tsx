import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useDocumentStore } from '@/state/documentStore';
import { useMapInstance } from './mapInstance';
import { layerRenderIds, syncLayersToMap } from './syncLayers';

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
    const apply = () => syncLayersToMap(map, layersRef.current);
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
        .flatMap((l) => Object.values(layerRenderIds(l.id)))
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
