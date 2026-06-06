import type maplibregl from 'maplibre-gl';
import { useDocumentStore } from '@/state/documentStore';
import { featureFillKey } from '@/layers/geojsonFeatureStyle';
import { useFeatureMenuStore } from './featureMenuStore';
import { layerIdFromRenderId, layerRenderIds } from './syncLayers';

/**
 * Query the data layers rendered at a map pixel point and, if one is hit, select
 * the feature and open the right-click feature menu at the given screen position.
 * Returns true when a feature was hit.
 *
 * Shared by two callers because the right-click can arrive through two different
 * elements: MapLibre's own `contextmenu` handler (when the Konva annotation
 * overlay is letting events fall through), and the Konva `Stage` handler (when
 * the overlay is capturing pointer events in editing mode). `point` is in the
 * map's pixel space; `client` is viewport coordinates for the fixed-position menu.
 */
export function openFeatureMenuAtPoint(
  map: maplibregl.Map,
  point: { x: number; y: number },
  client: { x: number; y: number },
): boolean {
  const layers = useDocumentStore.getState().project.layers;
  const ids = layers
    .flatMap((l) => Object.values(layerRenderIds(l.id)))
    .filter((id) => map.getLayer(id));
  const hits = ids.length ? map.queryRenderedFeatures([point.x, point.y], { layers: ids }) : [];
  if (hits.length === 0) {
    useFeatureMenuStore.getState().close();
    return false;
  }
  const hit = hits[0];
  const layerId = layerIdFromRenderId(hit.layer.id);
  const properties = hit.properties ?? {};
  useDocumentStore.getState().selectFeature({ layerId, properties, fillKey: featureFillKey(properties) });
  const layer = layers.find((l) => l.id === layerId);
  useFeatureMenuStore.getState().open({
    x: client.x,
    y: client.y,
    layerId,
    layerName: layer?.name ?? '',
    locked: layer?.locked ?? false,
  });
  return true;
}
