import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { featureFillKey } from '@/layers/geojsonFeatureStyle';
import { useMapInstance } from './mapInstance';
import { openFeatureMenuAtPoint } from './openFeatureMenu';
import { layerIdFromRenderId, layerRenderIds, syncLayersToMap } from './syncLayers';

/**
 * Headless renderer: projects the document's imported GeoJSON layers onto the
 * MapLibre map and routes feature clicks to the attribute inspector. Owns no
 * state — it reconciles the map to the document store.
 */
export function GeoJsonLayers() {
  const map = useMapInstance((s) => s.map);
  const layers = useDocumentStore((s) => s.project.layers);
  const selectedFeature = useDocumentStore((s) => s.selectedFeature);
  const selectFeature = useDocumentStore((s) => s.selectFeature);
  const editingLayerId = useEditStore((s) => s.editingLayerId);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const selectedFeatureRef = useRef(selectedFeature);
  selectedFeatureRef.current = selectedFeature;
  const editingLayerIdRef = useRef(editingLayerId);
  editingLayerIdRef.current = editingLayerId;

  useEffect(() => {
    if (!map) return;
    const apply = () =>
      syncLayersToMap(map, layersRef.current, selectedFeatureRef.current, editingLayerIdRef.current);
    apply();
    // A theme-driven setStyle() wipes custom sources — re-add once it reloads.
    map.on('styledata', apply);
    return () => {
      map.off('styledata', apply);
    };
  }, [map, layers, selectedFeature, editingLayerId]);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      // While the vector editor is active, terra-draw owns map clicks — yield.
      if (editingLayerIdRef.current) return;
      const ids = layersRef.current
        .flatMap((l) => Object.values(layerRenderIds(l.id)))
        .filter((id) => map.getLayer(id));
      const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      if (hits.length === 0) {
        selectFeature(null);
        return;
      }
      const hit = hits[0];
      const layerId = layerIdFromRenderId(hit.layer.id);
      const properties = hit.properties ?? {};
      selectFeature({ layerId, properties, fillKey: featureFillKey(properties) });
    };
    const onContextMenu = (e: maplibregl.MapMouseEvent) => {
      // While editing, terra-draw owns right-click (vertex deletion etc.). The
      // Konva overlay's Stage handler covers the data-layer right-click in that
      // mode (it captures the event before MapLibre sees it).
      if (editingLayerIdRef.current) return;
      const hit = openFeatureMenuAtPoint(
        map,
        e.point,
        { x: e.originalEvent.clientX, y: e.originalEvent.clientY },
      );
      if (hit) {
        // Suppress the browser menu and show our own.
        e.preventDefault();
        e.originalEvent.preventDefault();
      }
    };

    map.on('click', onClick);
    map.on('contextmenu', onContextMenu);
    return () => {
      map.off('click', onClick);
      map.off('contextmenu', onContextMenu);
    };
  }, [map, selectFeature]);

  return null;
}
