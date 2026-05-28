import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  DEFAULT_ANNOTATION_STYLE,
  DEFAULT_BASEMAP,
  DEFAULT_GEOJSON_STYLE,
  type Annotation,
  type GeoJsonLayer,
} from './cartoproj';
import { deserializeProject, ProjectLoadError, serializeProject } from './serialize';

function rectAnnotation(): Annotation {
  return {
    id: 'a1',
    kind: 'rectangle',
    name: 'Rect',
    visible: true,
    locked: false,
    anchorMode: 'canvas',
    position: { x: 10, y: 20 },
    geoAnchor: null,
    rotation: 0,
    opacity: 1,
    style: { ...DEFAULT_ANNOTATION_STYLE },
    width: 100,
    height: 50,
    cornerRadius: 4,
  };
}

function pinAnnotation(): Annotation {
  return {
    id: 'a2',
    kind: 'pin',
    name: 'Pin',
    visible: true,
    locked: false,
    anchorMode: 'map',
    position: { x: 0, y: 0 },
    geoAnchor: [2.35, 48.85],
    rotation: 0,
    opacity: 1,
    style: { ...DEFAULT_ANNOTATION_STYLE },
    label: 'Paris',
    size: 24,
  };
}

function measurementAnnotation(): Annotation {
  return {
    id: 'a3',
    kind: 'measurement',
    name: 'Distance',
    visible: true,
    locked: false,
    anchorMode: 'map',
    position: { x: 100, y: 120 },
    geoAnchor: [2.35, 48.85],
    rotation: 0,
    opacity: 1,
    style: { ...DEFAULT_ANNOTATION_STYLE },
    groupId: 'g1',
    points: [0, 0, 90, 30],
    geoPoints: [
      [2.35, 48.85],
      [2.36, 48.86],
    ],
    unitSystem: 'metric',
  };
}

function geoLayer(): GeoJsonLayer {
  return {
    id: 'l1',
    kind: 'geojson',
    name: 'Roads',
    visible: true,
    locked: false,
    geometry: 'line',
    featureCount: 1,
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Main St' },
          geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        },
      ],
    },
    style: { ...DEFAULT_GEOJSON_STYLE },
  };
}

describe('serializeProject / deserializeProject', () => {
  it('round-trips an empty project', () => {
    const original = createEmptyProject('Demo');
    const restored = deserializeProject(serializeProject(original));
    expect(restored).toEqual(original);
  });

  it('round-trips a project with layers and mixed annotations', () => {
    const original = createEmptyProject('Cities');
    original.layers.push(geoLayer());
    original.annotations.push(rectAnnotation(), pinAnnotation(), measurementAnnotation());
    original.annotationGroups.push({
      id: 'g1',
      name: 'Inset labels',
      locked: false,
      annotationIds: ['a1', 'a3'],
    });
    original.mode = 'editing';
    original.lockedMapView = {
      viewport: { center: [2, 48], zoom: 6, bearing: 0, pitch: 0 },
      exportFrame: { ...original.exportFrame },
      basemap: original.basemap,
      lockedAt: '2026-05-25T12:00:00.000Z',
    };
    const restored = deserializeProject(serializeProject(original));
    expect(restored).toEqual(original);
    expect(restored.annotations).toHaveLength(3);
    expect(restored.annotationGroups[0].annotationIds).toEqual(['a1', 'a3']);
    expect(restored.layers[0].data.features).toHaveLength(1);
  });

  it('rejects malformed JSON', () => {
    expect(() => deserializeProject('not json')).toThrow(ProjectLoadError);
  });

  it('rejects an unsupported version', () => {
    const project = createEmptyProject() as unknown as { version: number };
    project.version = 2;
    expect(() => deserializeProject(JSON.stringify(project))).toThrow(/version/i);
  });

  it('rejects a missing meta block', () => {
    const project = createEmptyProject() as unknown as { meta?: unknown };
    delete project.meta;
    expect(() => deserializeProject(JSON.stringify(project))).toThrow(/meta/i);
  });

  it('rejects a non-numeric viewport center', () => {
    const project = createEmptyProject();
    (project.viewport as unknown as { center: unknown[] }).center = ['x', 'y'];
    expect(() => deserializeProject(JSON.stringify(project))).toThrow(/center/i);
  });

  it('defaults optional Phase 1 fields from older v1 project files', () => {
    const project = createEmptyProject('Legacy') as unknown as {
      annotations?: unknown;
      annotationGroups?: unknown;
      basemap?: unknown;
      lockedMapView?: unknown;
    };
    delete project.annotations;
    delete project.annotationGroups;
    delete project.basemap;
    delete project.lockedMapView;

    const restored = deserializeProject(JSON.stringify(project));
    expect(restored.annotations).toEqual([]);
    expect(restored.annotationGroups).toEqual([]);
    expect(restored.basemap).toEqual(DEFAULT_BASEMAP);
    expect(restored.lockedMapView).toBeNull();
  });

  it('defaults basemap sub-layers on built-in basemaps from older v1 project files', () => {
    const project = createEmptyProject('Legacy basemap');
    delete (project.basemap as { sublayers?: unknown }).sublayers;

    const restored = deserializeProject(JSON.stringify(project));
    if (restored.basemap.kind !== 'builtin') throw new Error('expected builtin basemap');
    expect(restored.basemap.sublayers).toEqual({
      roads: true,
      labels: true,
      water: true,
      landuse: true,
      buildings: true,
      boundaries: true,
    });
  });

  it('preserves partial basemap sub-layer overrides while defaulting missing keys', () => {
    const project = createEmptyProject('Partial sublayers');
    if (project.basemap.kind === 'builtin') {
      (project.basemap as { sublayers: Record<string, unknown> }).sublayers = { labels: false };
    }
    const restored = deserializeProject(JSON.stringify(project));
    if (restored.basemap.kind !== 'builtin') throw new Error('expected builtin basemap');
    expect(restored.basemap.sublayers.labels).toBe(false);
    expect(restored.basemap.sublayers.roads).toBe(true);
  });

  it('defaults newer annotation effect fields from older v1 project files', () => {
    const project = createEmptyProject('Legacy effects');
    const annotation = rectAnnotation();
    delete (annotation.style as Partial<typeof annotation.style>).haloColor;
    delete (annotation.style as Partial<typeof annotation.style>).haloWidth;
    delete (annotation.style as Partial<typeof annotation.style>).shadowColor;
    delete (annotation.style as Partial<typeof annotation.style>).shadowBlur;
    delete (annotation.style as Partial<typeof annotation.style>).shadowOffsetX;
    delete (annotation.style as Partial<typeof annotation.style>).shadowOffsetY;
    delete (annotation.style as Partial<typeof annotation.style>).blendMode;
    project.annotations.push(annotation);

    const restored = deserializeProject(JSON.stringify(project));
    const style = restored.annotations[0].style;
    expect(style.haloWidth).toBe(0);
    expect(style.haloColor).toBe('#ffffff');
    expect(style.shadowBlur).toBe(0);
    expect(style.shadowColor).toBe('#000000');
    expect(style.shadowOffsetX).toBe(0);
    expect(style.shadowOffsetY).toBe(0);
    expect(style.blendMode).toBe('normal');
  });

  it('defaults newer annotation style fields from older v1 project files', () => {
    const project = createEmptyProject('Legacy styles');
    const annotation = rectAnnotation();
    delete (annotation.style as Partial<typeof annotation.style>).fillPattern;
    delete (annotation.style as Partial<typeof annotation.style>).hatchColor;
    delete (annotation.style as Partial<typeof annotation.style>).hatchSpacing;
    delete (annotation.style as Partial<typeof annotation.style>).strokePattern;
    project.annotations.push(annotation);

    const restored = deserializeProject(JSON.stringify(project));
    expect(restored.annotations[0].style.fillPattern).toBe('none');
    expect(restored.annotations[0].style.hatchColor).toBe('#0f172a');
    expect(restored.annotations[0].style.hatchSpacing).toBe(10);
    expect(restored.annotations[0].style.strokePattern).toBe('solid');
  });

  it('defaults newer legend entry fill styles from older v1 project files', () => {
    const project = createEmptyProject('Legacy legend');
    const annotation = rectAnnotation();
    project.annotations.push({
      id: annotation.id,
      kind: 'legend',
      name: 'Legend',
      visible: annotation.visible,
      locked: annotation.locked,
      anchorMode: annotation.anchorMode,
      position: annotation.position,
      geoAnchor: annotation.geoAnchor,
      rotation: annotation.rotation,
      opacity: annotation.opacity,
      style: annotation.style,
      title: 'Legend',
      entries: [{ label: 'Industrial port', swatchColor: '#007aff', visible: true }],
      width: 200,
    });

    const restored = deserializeProject(JSON.stringify(project));
    const legend = restored.annotations[0];
    expect(legend.kind).toBe('legend');
    if (legend.kind !== 'legend') return;
    expect(legend.entries[0].fillStyle).toEqual({
      fillColor: '#007aff',
      fillPattern: 'none',
      hatchColor: '#0f172a',
      hatchSpacing: 10,
    });
  });

  it('rejects invalid export frame dimensions', () => {
    const project = createEmptyProject();
    project.exportFrame.width = 0;
    expect(() => deserializeProject(JSON.stringify(project))).toThrow(/export frame/i);

    project.exportFrame.width = 1600;
    project.exportFrame.height = Number.NaN;
    expect(() => deserializeProject(JSON.stringify(project))).toThrow(/export frame/i);
  });
});
