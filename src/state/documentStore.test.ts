import { describe, expect, it, beforeEach } from 'vitest';
import { useDocumentStore } from './documentStore';
import { DEFAULT_VIEWPORT } from './viewportStore';
import {
  createEmptyProject,
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_GEOJSON_STYLE,
  type Annotation,
  type GeoJsonLayer,
} from '@/project/cartoproj';

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

function makeAnnotation(name: string): Annotation {
  return {
    id: crypto.randomUUID(),
    kind: 'rectangle',
    name,
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

const ids = () => useDocumentStore.getState().project.layers.map((l) => l.name);

describe('documentStore', () => {
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
  });

  it('marks the document dirty on mutation and clean on save', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    expect(useDocumentStore.getState().dirty).toBe(true);
    useDocumentStore.getState().markSaved({ handle: null, name: 'demo.cartoproj' });
    expect(useDocumentStore.getState().dirty).toBe(false);
    expect(useDocumentStore.getState().file?.name).toBe('demo.cartoproj');

    useDocumentStore.getState().addLayer(makeLayer('Roads'));
    expect(useDocumentStore.getState().dirty).toBe(true);
  });

  it('replaces the project and resets dirty/selection', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    useDocumentStore.getState().addLayer(makeLayer('Roads'));
    const replacement = createEmptyProject('Other');
    useDocumentStore.getState().replaceProject(replacement, { handle: null, name: 'other.cartoproj' });
    expect(useDocumentStore.getState().project).toEqual(replacement);
    expect(useDocumentStore.getState().dirty).toBe(false);
    expect(useDocumentStore.getState().selectedLayerId).toBeNull();
    expect(useDocumentStore.getState().file?.name).toBe('other.cartoproj');
  });

  it('creates empty projects with an annotation collection', () => {
    expect(useDocumentStore.getState().project.annotations).toEqual([]);
    expect(useDocumentStore.getState().project.mode).toBe('mapSetup');
    expect(useDocumentStore.getState().project.lockedMapView).toBeNull();
    expect(useDocumentStore.getState().project.basemap.kind).toBe('builtin');
  });

  it('locks and unlocks the map area', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    expect(useDocumentStore.getState().project.mode).toBe('editing');
    expect(useDocumentStore.getState().project.lockedMapView?.viewport).toEqual(DEFAULT_VIEWPORT);

    useDocumentStore.getState().unlockMapArea();
    expect(useDocumentStore.getState().project.mode).toBe('mapSetup');
  });

  it('does not add layers or annotations before map setup is locked', () => {
    useDocumentStore.getState().addLayer(makeLayer('Roads'));
    useDocumentStore.getState().addAnnotation(makeAnnotation('Note'));
    expect(useDocumentStore.getState().project.layers).toEqual([]);
    expect(useDocumentStore.getState().project.annotations).toEqual([]);
  });

  it('adds layers and selects the newest', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const layer = makeLayer('Roads');
    useDocumentStore.getState().addLayer(layer);
    expect(ids()).toEqual(['Roads']);
    expect(useDocumentStore.getState().selectedLayerId).toBe(layer.id);
  });

  it('reorders layers within the stack', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
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
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const layer = makeLayer('Old');
    useDocumentStore.getState().addLayer(layer);
    useDocumentStore.setState({ dirty: false });
    useDocumentStore.getState().renameLayer(layer.id, 'New');
    useDocumentStore.getState().setLayerVisible(layer.id, false);
    useDocumentStore.getState().setLayerLocked(layer.id, true);
    const stored = useDocumentStore.getState().project.layers[0];
    expect(stored.name).toBe('New');
    expect(stored.visible).toBe(false);
    expect(stored.locked).toBe(true);
    expect(useDocumentStore.getState().dirty).toBe(true);
  });

  it('updates GeoJSON layer style and blocks locked layer mutations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const a = makeLayer('A');
    const b = makeLayer('B');
    useDocumentStore.getState().addLayer(a);
    useDocumentStore.getState().addLayer(b);
    useDocumentStore.setState({ dirty: false });

    useDocumentStore.getState().updateLayerStyle(a.id, {
      fillColor: '#34c759',
      fillOpacity: 0.5,
      strokeWidth: 3,
      pointRadius: 9,
    });
    let stored = useDocumentStore.getState().project.layers[0];
    expect(stored.style.fillColor).toBe('#34c759');
    expect(stored.style.fillOpacity).toBe(0.5);
    expect(stored.style.strokeWidth).toBe(3);
    expect(stored.style.pointRadius).toBe(9);
    expect(useDocumentStore.getState().dirty).toBe(true);

    useDocumentStore.getState().setLayerLocked(a.id, true);
    useDocumentStore.setState({ dirty: false });
    useDocumentStore.getState().renameLayer(a.id, 'Locked rename');
    useDocumentStore.getState().updateLayerStyle(a.id, { fillColor: '#ff3b30' });
    useDocumentStore.getState().moveLayer(a.id, 'up');
    useDocumentStore.getState().removeLayer(a.id);

    stored = useDocumentStore.getState().project.layers.find((layer) => layer.id === a.id)!;
    expect(stored.name).toBe('A');
    expect(stored.style.fillColor).toBe('#34c759');
    expect(useDocumentStore.getState().project.layers.map((layer) => layer.name)).toEqual(['A', 'B']);
    expect(useDocumentStore.getState().dirty).toBe(false);
  });

  it('removing a selected layer clears its selection', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const layer = makeLayer('Temp');
    useDocumentStore.getState().addLayer(layer);
    useDocumentStore.getState().selectFeature({ layerId: layer.id, properties: {} });
    useDocumentStore.getState().removeLayer(layer.id);
    expect(ids()).toEqual([]);
    expect(useDocumentStore.getState().selectedLayerId).toBeNull();
    expect(useDocumentStore.getState().selectedFeature).toBeNull();
  });

  it('adds, selects, updates, reorders, hides, and deletes annotations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const a = makeAnnotation('A');
    const b = makeAnnotation('B');
    useDocumentStore.getState().addAnnotation(a);
    useDocumentStore.getState().addAnnotation(b);
    expect(useDocumentStore.getState().selectedAnnotationId).toBe(b.id);
    expect(useDocumentStore.getState().selectedAnnotationIds).toEqual([b.id]);

    useDocumentStore.getState().updateAnnotation(a.id, { position: { x: 22, y: 33 } });
    useDocumentStore.getState().updateAnnotationStyle(a.id, { fillColor: '#34c759' });
    useDocumentStore.getState().moveAnnotation(a.id, 'up');
    useDocumentStore.getState().setAnnotationVisible(a.id, false);

    const annotations = useDocumentStore.getState().project.annotations;
    expect(annotations.map((item) => item.name)).toEqual(['B', 'A']);
    expect(annotations[1].visible).toBe(false);
    expect(annotations[1].position).toEqual({ x: 22, y: 33 });
    expect(annotations[1].style.fillColor).toBe('#34c759');

    useDocumentStore.getState().removeAnnotation(a.id);
    expect(useDocumentStore.getState().project.annotations.map((item) => item.name)).toEqual(['B']);
  });

  it('groups, moves, and ungroups selected annotations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const a = makeAnnotation('A');
    const b = makeAnnotation('B');
    useDocumentStore.getState().addAnnotation(a);
    useDocumentStore.getState().addAnnotation(b);
    useDocumentStore.getState().setSelectedAnnotations([a.id, b.id]);
    useDocumentStore.getState().groupSelectedAnnotations();

    const group = useDocumentStore.getState().project.annotationGroups[0];
    expect(group.annotationIds).toEqual([a.id, b.id]);
    expect(useDocumentStore.getState().project.annotations.map((item) => item.groupId)).toEqual([
      group.id,
      group.id,
    ]);

    useDocumentStore.getState().moveAnnotations([
      { id: a.id, position: { x: 30, y: 40 } },
      { id: b.id, position: { x: 50, y: 60 } },
    ]);
    expect(useDocumentStore.getState().project.annotations.map((item) => item.position)).toEqual([
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);

    useDocumentStore.getState().ungroupSelectedAnnotations();
    expect(useDocumentStore.getState().project.annotationGroups).toEqual([]);
    expect(useDocumentStore.getState().project.annotations.map((item) => item.groupId)).toEqual([
      null,
      null,
    ]);
  });

  it('updates annotation text, pin labels, and map anchors through patches', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const text: Annotation = {
      ...makeAnnotation('Text'),
      kind: 'text',
      text: 'Old',
      width: 120,
    };
    const pin: Annotation = {
      ...makeAnnotation('Pin'),
      kind: 'pin',
      anchorMode: 'map',
      geoAnchor: [2.35, 48.85],
      label: 'Paris',
      size: 24,
    };
    useDocumentStore.getState().addAnnotation(text);
    useDocumentStore.getState().addAnnotation(pin);
    useDocumentStore.setState({ dirty: false });

    useDocumentStore.getState().updateAnnotation(text.id, { text: 'Updated' } as Partial<Annotation>);
    useDocumentStore.getState().updateAnnotation(pin.id, {
      label: 'Lyon',
      geoAnchor: [4.83, 45.76],
    } as Partial<Annotation>);

    const [storedText, storedPin] = useDocumentStore.getState().project.annotations;
    expect(storedText.kind === 'text' && storedText.text).toBe('Updated');
    expect(storedPin.kind === 'pin' && storedPin.label).toBe('Lyon');
    expect(storedPin.geoAnchor).toEqual([4.83, 45.76]);
    expect(useDocumentStore.getState().dirty).toBe(true);
  });

  it('does not edit or delete locked annotations', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const annotation = makeAnnotation('Locked');
    useDocumentStore.getState().addAnnotation(annotation);
    useDocumentStore.getState().setAnnotationLocked(annotation.id, true);
    useDocumentStore.getState().updateAnnotation(annotation.id, { position: { x: 99, y: 99 } });
    useDocumentStore.getState().updateAnnotationStyle(annotation.id, { fillColor: '#ff3b30' });
    useDocumentStore.getState().removeAnnotation(annotation.id);

    const stored = useDocumentStore.getState().project.annotations[0];
    expect(stored.position).toEqual({ x: 10, y: 20 });
    expect(stored.style.fillColor).toBe(DEFAULT_ANNOTATION_STYLE.fillColor);
    expect(stored.name).toBe('Locked');
  });

  it('keeps layer and annotation ordering independent', () => {
    useDocumentStore.getState().lockMapArea(DEFAULT_VIEWPORT);
    const layer = makeLayer('Roads');
    const annotation = makeAnnotation('Note');
    useDocumentStore.getState().addLayer(layer);
    useDocumentStore.getState().addAnnotation(annotation);
    useDocumentStore.getState().moveAnnotation(annotation.id, 'up');
    useDocumentStore.getState().moveLayer(layer.id, 'up');

    expect(useDocumentStore.getState().project.layers.map((item) => item.name)).toEqual(['Roads']);
    expect(useDocumentStore.getState().project.annotations.map((item) => item.name)).toEqual(['Note']);
  });
});
