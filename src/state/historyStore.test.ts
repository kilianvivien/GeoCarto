import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from './documentStore';
import {
  installHistoryCapture,
  useHistoryStore,
  hintHistoryLabel,
  hintDiscreteHistoryLabel,
} from './historyStore';
import {
  createEmptyProject,
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_GEOJSON_STYLE,
  type Annotation,
} from '@/project/cartoproj';

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
      ...DEFAULT_GEOJSON_STYLE,
      fillColor: '#000',
      fillOpacity: 1,
      hatchColor: '#000',
      hatchSpacing: 10,
      strokeColor: '#000',
      strokeWidth: 1,
      pointColor: '#000',
      pointRadius: 4,
    },
  };
}

function makeAnnotation(id: string): Annotation {
  return {
    id,
    kind: 'rectangle',
    name: id,
    visible: true,
    locked: false,
    anchorMode: 'canvas',
    position: { x: 10, y: 20 },
    geoAnchor: null,
    rotation: 0,
    opacity: 1,
    style: { ...DEFAULT_ANNOTATION_STYLE },
    width: 100,
    height: 80,
    cornerRadius: 8,
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

  it('undoes layer deletion as a discrete step after recent layer edits', () => {
    const { addLayer, renameLayer, removeLayer } = useDocumentStore.getState();
    addLayer(makeLayer('delete-me'));
    useHistoryStore.getState().reset();

    hintHistoryLabel('Rename layer');
    renameLayer('delete-me', 'Renamed');
    hintDiscreteHistoryLabel('Delete layer');
    removeLayer('delete-me');

    expect(useDocumentStore.getState().project.layers).toEqual([]);
    expect(useHistoryStore.getState().past.map((entry) => entry.label)).toEqual([
      'Rename layer',
      'Delete layer',
    ]);

    expect(useHistoryStore.getState().undo()).toBe(true);
    expect(useDocumentStore.getState().project.layers).toHaveLength(1);
    expect(useDocumentStore.getState().project.layers[0].name).toBe('Renamed');
  });

  it('undoes annotation deletion as a discrete step', () => {
    const { addAnnotation, removeAnnotation } = useDocumentStore.getState();
    addAnnotation(makeAnnotation('note'));
    useHistoryStore.getState().reset();

    hintDiscreteHistoryLabel('Delete annotation');
    removeAnnotation('note');

    expect(useDocumentStore.getState().project.annotations).toEqual([]);
    expect(useHistoryStore.getState().past.map((entry) => entry.label)).toEqual([
      'Delete annotation',
    ]);

    expect(useHistoryStore.getState().undo()).toBe(true);
    expect(useDocumentStore.getState().project.annotations).toHaveLength(1);
    expect(useDocumentStore.getState().project.annotations[0].id).toBe('note');
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
