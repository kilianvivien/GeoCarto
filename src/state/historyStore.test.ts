import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from './documentStore';
import { installHistoryCapture, useHistoryStore, hintHistoryLabel } from './historyStore';
import { createEmptyProject } from '@/project/cartoproj';

function makeLayer(id: string) {
  return {
    id,
    kind: 'geojson' as const,
    name: id,
    visible: true,
    locked: false,
    geometry: 'point' as const,
    featureCount: 0,
    data: { type: 'FeatureCollection' as const, features: [] },
    style: {
      fillColor: '#000',
      fillOpacity: 1,
      fillPattern: 'none' as const,
      hatchColor: '#000',
      hatchSpacing: 10,
      strokeColor: '#000',
      strokeWidth: 1,
      pointColor: '#000',
      pointRadius: 4,
    },
  };
}

describe('historyStore', () => {
  let detach: () => void;

  beforeEach(() => {
    const project = createEmptyProject();
    project.mode = 'editing';
    useDocumentStore.setState({
      project,
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedFeature: null,
      dirty: false,
      file: null,
    });
    useHistoryStore.getState().reset();
    detach = installHistoryCapture();
  });

  afterEach(() => detach());

  it('captures discrete mutations and replays them via undo/redo', () => {
    const { addLayer, renameLayer } = useDocumentStore.getState();
    hintHistoryLabel('Add layer a');
    addLayer(makeLayer('a'));
    hintHistoryLabel('Add layer b');
    addLayer(makeLayer('b'));
    hintHistoryLabel('Rename layer');
    renameLayer('a', 'Alpha');

    const hist = useHistoryStore.getState();
    expect(hist.past).toHaveLength(3);

    hist.undo();
    expect(useDocumentStore.getState().project.layers.find((l) => l.id === 'a')!.name).toBe('a');
    hist.undo();
    expect(useDocumentStore.getState().project.layers).toHaveLength(1);
    hist.undo();
    expect(useDocumentStore.getState().project.layers).toEqual([]);

    hist.redo();
    hist.redo();
    hist.redo();
    expect(useDocumentStore.getState().project.layers).toHaveLength(2);
    expect(useDocumentStore.getState().project.layers.find((l) => l.id === 'a')!.name).toBe(
      'Alpha',
    );
  });

  it('coalesces a burst of same-label mutations into one history entry', () => {
    const { addLayer, updateLayerStyle } = useDocumentStore.getState();
    addLayer(makeLayer('drag-target'));
    useHistoryStore.getState().reset();

    for (let i = 0; i < 25; i += 1) {
      hintHistoryLabel('Drag annotation');
      updateLayerStyle('drag-target', { strokeWidth: i });
    }
    const hist = useHistoryStore.getState();
    expect(hist.past).toHaveLength(1);
    expect(hist.past[0].label).toBe('Drag annotation');
  });

  it('caps the history buffer at 100 entries', () => {
    const { addLayer, renameLayer } = useDocumentStore.getState();
    addLayer(makeLayer('cap'));
    useHistoryStore.getState().reset();
    for (let i = 0; i < 120; i += 1) {
      hintHistoryLabel(`op-${i}`); // unique labels → no coalescing
      renameLayer('cap', `name-${i}`);
    }
    expect(useHistoryStore.getState().past.length).toBe(100);
  });

  it('round-trips 100 operations without divergence', () => {
    const { addLayer, renameLayer } = useDocumentStore.getState();
    addLayer(makeLayer('roundtrip'));
    useHistoryStore.getState().reset();
    const start = JSON.stringify(useDocumentStore.getState().project);

    for (let i = 0; i < 100; i += 1) {
      hintHistoryLabel(`op-${i}`);
      renameLayer('roundtrip', `step-${i}`);
    }
    const end = JSON.stringify(useDocumentStore.getState().project);

    for (let i = 0; i < 100; i += 1) useHistoryStore.getState().undo();
    expect(JSON.stringify(useDocumentStore.getState().project)).toBe(start);

    for (let i = 0; i < 100; i += 1) useHistoryStore.getState().redo();
    expect(JSON.stringify(useDocumentStore.getState().project)).toBe(end);
  });
});
