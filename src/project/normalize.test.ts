import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthoringHints } from './authoringHints';
import { createEmptyProject } from './cartoproj';
import { checkProject } from './schema';
import { deserializeProject, serializeProject } from './serialize';

const point = (properties: Record<string, unknown>, coordinates: [number, number]) => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates },
});
const cities = {
  type: 'FeatureCollection',
  features: [
    point({ name: 'Paris', type: 'capital', pop: 2100 }, [2.35, 48.85]),
    point({ name: 'Lyon', type: 'city', pop: 520 }, [4.83, 45.76]),
    point({ name: 'Nice', type: 'city', pop: 340 }, [7.26, 43.7]),
    point({ name: 'Lille', type: 'city', pop: 230 }, [3.06, 50.63]),
  ],
};
const open = (document: unknown) => deserializeProject(JSON.stringify(document));

afterEach(() => useAuthoringHints.setState({ hints: null }));

describe('opening a compact authored project', () => {
  it('opens a document that only declares its version', () => {
    const project = open({ version: 1 });
    expect(project).toMatchObject({
      mode: 'mapSetup',
      engine: 'mercator',
      layers: [],
      annotations: [],
      lockedMapView: null,
      exportFrame: { width: 1600, height: 1200 },
      basemap: { kind: 'builtin', preset: 'editorial-light' },
    });
    expect(useAuthoringHints.getState().hints).toBeNull();
  });

  it('completes a layer: identity, geometry, style defaults', () => {
    const [layer] = open({ version: 1, layers: [{ data: cities, style: { pointRadius: 9 } }] }).layers;
    expect(layer).toMatchObject({ kind: 'geojson', name: 'Layer 1', visible: true, locked: false, geometry: 'point', featureCount: 4 });
    expect(layer.id).toEqual(expect.any(String));
    expect(layer.style).toMatchObject({ pointRadius: 9, fillColor: '#007aff', showPoints: true });
    expect(layer.data.features[0].id).toEqual(expect.any(String));
    expect(layer.data.features[0].properties?.['@id']).toBe(layer.data.features[0].id);
  });

  it('computes what a data style leaves out', () => {
    const styled = (dataStyle: unknown) =>
      open({ version: 1, layers: [{ data: structuredClone(cities), style: { dataStyle, pointColor: '#123456' } }] }).layers[0].style.dataStyle;

    expect(styled({ kind: 'choropleth', attribute: 'pop', classCount: 3 })).toMatchObject({
      method: 'quantile', classCount: 3, paletteId: 'blues', reverse: false, missingColor: '#cccccc',
      breaks: [expect.any(Number), expect.any(Number)],
    });
    expect(styled({ kind: 'choropleth', attribute: 'pop', method: 'manual', breaks: [300, 1000] })).toMatchObject({ breaks: [300, 1000] });
    expect(styled({ kind: 'proportional', attribute: 'pop' })).toEqual({
      kind: 'proportional', attribute: 'pop', minRadius: 4, maxRadius: 24, scale: 'sqrt', color: '#123456',
    });
    // Categories omitted → the most frequent values are colored automatically.
    expect(styled({ kind: 'categorical', attribute: 'type' })).toMatchObject({
      categories: [{ value: 'city', color: '#66c2a5' }, { value: 'capital', color: '#fc8d62' }],
      otherColor: '#cccccc',
    });
    // Categories given → kept exactly, in the author's order.
    expect(styled({ kind: 'categorical', attribute: 'type', categories: [{ value: 'capital', color: '#ff0000' }] })).toMatchObject({
      categories: [{ value: 'capital', color: '#ff0000' }],
    });
  });

  it('completes labels and generates a linked legend', () => {
    const project = open({
      version: 1,
      layers: [
        {
          id: 'cities',
          name: 'Cities',
          data: cities,
          style: { dataStyle: { kind: 'categorical', attribute: 'type' }, labels: { attribute: 'name' } },
        },
      ],
      annotations: [{ kind: 'legend', dataStyleLink: { layerId: 'cities' } }, { kind: 'titleblock', title: 'France' }],
    });
    expect(project.layers[0].style.labels).toEqual({ attribute: 'name', size: 12, color: '#1c1c1e', halo: true });
    const [legend, title] = project.annotations;
    expect(legend).toMatchObject({ kind: 'legend', title: 'Cities', anchorMode: 'canvas', visible: true, opacity: 1 });
    expect(legend.kind === 'legend' && legend.entries.map((entry) => entry.label)).toEqual(['city', 'capital']);
    // An omitted text field means "none", not the editor's placeholder wording.
    expect(title).toMatchObject({ kind: 'titleblock', title: 'France', subtitle: '' });
    expect(title.style.fontFamily).toBe('Inter');
  });

  it('opens ready to edit and anchors geo annotations to the map', () => {
    const project = open({
      version: 1,
      viewport: { center: [3, 47], zoom: 5 },
      layers: [{ data: cities }],
      annotations: [{ kind: 'pin', label: 'Capital', geoAnchor: [2.35, 48.85] }],
    });
    expect(project.mode).toBe('editing');
    expect(project.viewport).toEqual({ center: [3, 47], zoom: 5, bearing: 0, pitch: 0 });
    expect(project.lockedMapView).toMatchObject({ viewport: project.viewport, exportFrame: { width: 1600, height: 1200 } });
    expect(project.annotations[0]).toMatchObject({ anchorMode: 'map', geoAnchor: [2.35, 48.85], label: 'Capital' });
  });

  it('lifts layout hints out of the document for the live map to resolve', () => {
    const project = open({
      version: 1,
      viewport: { bounds: [-5, 41, 9, 51] },
      layers: [{ id: 'cities', data: cities, style: { dataStyle: { kind: 'categorical', attribute: 'type' } } }],
      annotations: [
        { kind: 'legend', place: 'top-right', width: 180, dataStyleLink: { layerId: 'cities' } },
        { kind: 'sourcecredit', place: 'bottom-left', text: 'Source: example' },
        { kind: 'pin', place: 'top-left', geoAnchor: [2, 48] },
      ],
    });
    // Nothing authoring-only is left behind in the saved document.
    expect(serializeProject(project)).not.toMatch(/"place"|"bounds"/);
    expect(project.viewport.center).toEqual([2, 46]);
    const { hints } = useAuthoringHints.getState();
    expect(hints?.bounds).toEqual([-5, 41, 9, 51]);
    // Map-anchored annotations keep their place on the map; only canvas ones snap to corners.
    expect(hints?.placements).toEqual([
      { id: project.annotations[0].id, corner: 'top-right', width: 180, height: 44 + 2 * 24 },
      { id: project.annotations[1].id, corner: 'bottom-left', width: 280, height: 22 },
    ]);
    // An authored legend is a neutral card, not the editor's accent-blue default.
    expect(project.annotations[0].style).toMatchObject({ fillColor: '#ffffff', strokeColor: '#c7c7cc', strokeWidth: 1 });
    expect([]).toEqual([
    ]);
  });

  it('refuses a malformed document with messages that name the field', () => {
    expect(() => open({ version: 1, layers: [{ name: 'Empty' }] })).toThrow(/layers\[0\]\.data: is required/);
  });
});

describe('opening a project the app saved', () => {
  it('leaves it byte-for-byte unchanged and records no hints', () => {
    const saved = createEmptyProject('Saved');
    saved.mode = 'editing';
    saved.layers.push({
      id: 'l1', kind: 'geojson', name: 'Kept', visible: false, locked: true, geometry: 'point', featureCount: 1,
      // No feature ids: an older file. Opening must not stamp any.
      data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { a: 1 }, geometry: { type: 'Point', coordinates: [1, 2] } }] },
      style: { ...open({ version: 1, layers: [{ data: cities }] }).layers[0].style },
      renderStrategy: 'vector',
    });
    const text = serializeProject(saved);
    expect(serializeProject(deserializeProject(text))).toBe(text);
    expect(useAuthoringHints.getState().hints).toBeNull();
  });
});

describe('the skill examples', () => {
  const example = (name: string) => readFileSync(resolve(process.cwd(), 'skills/geocarto-maps/examples', name), 'utf8');

  it('ships a project that validates cleanly and opens as a finished map', () => {
    const text = example('minimal.cartoproj');
    expect(checkProject(JSON.parse(text))).toEqual([]);
    const project = deserializeProject(text);
    expect(project.mode).toBe('editing');
    expect(project.layers[0]).toMatchObject({ id: 'sites', geometry: 'point', featureCount: 6 });
    const legend = project.annotations.find((annotation) => annotation.kind === 'legend');
    expect(legend?.kind === 'legend' && legend.entries.map((entry) => `${entry.label} ${entry.swatchColor}`)).toEqual([
      'museum #1f77b4', 'palace #e4572e', 'monument #2ca02c',
    ]);
    expect(useAuthoringHints.getState().hints?.placements.map((placement) => placement.corner)).toEqual([
      'top-left', 'top-right', 'bottom-left',
    ]);
  });
});
