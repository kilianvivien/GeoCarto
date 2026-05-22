import { describe, expect, it, beforeEach } from 'vitest';
import { useDocumentStore } from './documentStore';
import { createEmptyProject, DEFAULT_GEOJSON_STYLE, type GeoJsonLayer } from '@/project/cartoproj';

function makeLayer(name: string): GeoJsonLayer {
  return {
    id: crypto.randomUUID(),
    kind: 'geojson',
    name,
    visible: true,
    locked: false,
    geometry: 'point',
    featureCount: 1,
    data: { type: 'FeatureCollection', features: [] },
    style: { ...DEFAULT_GEOJSON_STYLE },
  };
}

const ids = () => useDocumentStore.getState().project.layers.map((l) => l.name);

describe('documentStore', () => {
  beforeEach(() => {
    useDocumentStore.setState({
      project: createEmptyProject(),
      selectedLayerId: null,
      selectedFeature: null,
    });
  });

  it('adds layers and selects the newest', () => {
    const layer = makeLayer('Roads');
    useDocumentStore.getState().addLayer(layer);
    expect(ids()).toEqual(['Roads']);
    expect(useDocumentStore.getState().selectedLayerId).toBe(layer.id);
  });

  it('reorders layers within the stack', () => {
    const a = makeLayer('A');
    const b = makeLayer('B');
    useDocumentStore.getState().addLayer(a);
    useDocumentStore.getState().addLayer(b);
    expect(ids()).toEqual(['A', 'B']);

    useDocumentStore.getState().moveLayer(a.id, 'up');
    expect(ids()).toEqual(['B', 'A']);

    useDocumentStore.getState().moveLayer(a.id, 'up'); // already on top — no-op
    expect(ids()).toEqual(['B', 'A']);

    useDocumentStore.getState().moveLayer(a.id, 'down');
    expect(ids()).toEqual(['A', 'B']);
  });

  it('renames and toggles visibility / lock', () => {
    const layer = makeLayer('Old');
    useDocumentStore.getState().addLayer(layer);
    useDocumentStore.getState().renameLayer(layer.id, 'New');
    useDocumentStore.getState().setLayerVisible(layer.id, false);
    useDocumentStore.getState().setLayerLocked(layer.id, true);
    const stored = useDocumentStore.getState().project.layers[0];
    expect(stored.name).toBe('New');
    expect(stored.visible).toBe(false);
    expect(stored.locked).toBe(true);
  });

  it('removing a selected layer clears its selection', () => {
    const layer = makeLayer('Temp');
    useDocumentStore.getState().addLayer(layer);
    useDocumentStore.getState().selectFeature({ layerId: layer.id, properties: {} });
    useDocumentStore.getState().removeLayer(layer.id);
    expect(ids()).toEqual([]);
    expect(useDocumentStore.getState().selectedLayerId).toBeNull();
    expect(useDocumentStore.getState().selectedFeature).toBeNull();
  });
});
