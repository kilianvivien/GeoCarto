import { describe, expect, it, beforeEach } from 'vitest';
import { useEditStore } from './editStore';
import { useDocumentStore } from './documentStore';
import { DEFAULT_VIEWPORT } from './viewportStore';
import { createEmptyProject, DEFAULT_GEOJSON_STYLE, type GeoJsonLayer } from '@/project/cartoproj';

function seedLayer(locked = false): GeoJsonLayer {
  const layer: GeoJsonLayer = {
    id: crypto.randomUUID(),
    kind: 'geojson',
    name: 'Editable',
    visible: true,
    locked: false,
    geometry: 'point',
    featureCount: 1,
    data: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } }],
    },
    style: { ...DEFAULT_GEOJSON_STYLE },
  };
  useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
  useDocumentStore.getState().addLayer(layer);
  if (locked) useDocumentStore.getState().setLayerLocked(layer.id, true);
  return layer;
}

describe('editStore', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      project: createEmptyProject(),
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedAnnotationIds: [],
      selectedFeature: null,
      dirty: false,
      file: null,
    });
    useEditStore.setState({ editingLayerId: null, activeTool: 'select', selectedFeatureId: null });
  });

  it('enters edit mode, assigns feature ids, and focuses the layer', () => {
    const layer = seedLayer();
    useEditStore.getState().enterEdit(layer.id);
    expect(useEditStore.getState().editingLayerId).toBe(layer.id);
    expect(useDocumentStore.getState().selectedLayerId).toBe(layer.id);
    expect(useDocumentStore.getState().project.layers[0].data.features[0].id).toBeTruthy();
  });

  it('refuses to enter a locked layer', () => {
    const layer = seedLayer(true);
    useEditStore.getState().enterEdit(layer.id);
    expect(useEditStore.getState().editingLayerId).toBeNull();
  });

  it('tracks tool and feature selection, and clears them on exit', () => {
    const layer = seedLayer();
    useEditStore.getState().enterEdit(layer.id);
    useEditStore.getState().setTool('polygon');
    useEditStore.getState().selectFeature('f1');
    expect(useEditStore.getState().activeTool).toBe('polygon');
    expect(useEditStore.getState().selectedFeatureId).toBe('f1');

    useEditStore.getState().exitEdit();
    expect(useEditStore.getState().editingLayerId).toBeNull();
    expect(useEditStore.getState().activeTool).toBe('select');
    expect(useEditStore.getState().selectedFeatureId).toBeNull();
  });
});
