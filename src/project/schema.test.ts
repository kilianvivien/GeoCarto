import { describe, expect, it } from 'vitest';
import { checkFeatureCollection, checkProject, formatIssues } from './schema';

const point = (properties: Record<string, unknown>, coordinates = [2.35, 48.85]) => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates },
});
const collection = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const layer = (extra: Record<string, unknown> = {}) => ({
  id: 'cities',
  name: 'Cities',
  data: collection(point({ name: 'Paris', type: 'capital', pop: 2.1 }), point({ name: 'Lyon', type: 'city', pop: 0.5 }, [4.83, 45.76])),
  ...extra,
});

const errors = (value: unknown) => checkProject(value).filter((i) => i.severity === 'error').map((i) => i.path);
const warnings = (value: unknown) => checkProject(value).filter((i) => i.severity === 'warning').map((i) => i.path);

describe('checkProject', () => {
  it('accepts the smallest possible document', () => {
    expect(checkProject({ version: 1 })).toEqual([]);
  });

  it('requires an object and version 1', () => {
    expect(errors([])).toEqual(['']);
    expect(errors({})).toEqual(['version']);
    expect(errors({ version: 2 })).toEqual(['version']);
  });

  it('checks the type of whatever is present, by path', () => {
    const issues = checkProject({
      version: 1,
      mode: 'draft',
      meta: { name: 3 },
      viewport: { center: [48.85, 200], zoom: 40, bounds: [5, 40, 1, 50] },
      exportFrame: { width: 0, height: 'tall' },
      basemap: { preset: 'neon' },
      layers: 'none',
      annotations: {},
    });
    expect(issues.map((i) => i.path).sort()).toEqual([
      'annotations', 'basemap.kind', 'basemap.preset', 'exportFrame.height', 'exportFrame.width', 'layers',
      'meta.name', 'mode', 'viewport.bounds', 'viewport.center', 'viewport.zoom',
    ]);
    expect(formatIssues(issues)).toContain('error   viewport.bounds: must be [west, south, east, north]');
  });

  it('accepts a compact authored map', () => {
    expect(
      checkProject({
        version: 1,
        viewport: { bounds: [1, 44, 6, 50] },
        layers: [
          layer({
            style: {
              dataStyle: { kind: 'categorical', attribute: 'type', categories: [{ value: 'capital', color: '#ff0000' }] },
              labels: { attribute: 'name', valueAttribute: 'pop' },
            },
          }),
        ],
        annotations: [
          { kind: 'legend', place: 'top-right', dataStyleLink: { layerId: 'cities' } },
          { kind: 'pin', geoAnchor: [2.35, 48.85], label: 'Here' },
        ],
      }),
    ).toEqual([]);
  });

  it('rejects structurally broken layers', () => {
    expect(errors({ version: 1, layers: [{ name: 'No data' }] })).toEqual(['layers[0].data']);
    expect(errors({ version: 1, layers: [layer({ data: { type: 'Feature' } })] })).toEqual(['layers[0].data']);
    expect(errors({ version: 1, layers: [layer(), layer()] })).toEqual(['layers[1].id']);
    expect(errors({ version: 1, layers: [layer({ data: collection({ type: 'Thing' }) })] })).toEqual(['layers[0].data.features[0]']);
  });

  it('rejects malformed data styles', () => {
    const withStyle = (dataStyle: unknown) => ({ version: 1, layers: [layer({ style: { dataStyle } })] });
    expect(errors(withStyle({ kind: 'rainbow' }))).toEqual(['layers[0].style.dataStyle.kind']);
    expect(errors(withStyle({ kind: 'choropleth' }))).toEqual(['layers[0].style.dataStyle.attribute']);
    expect(errors(withStyle({ kind: 'choropleth', attribute: 'pop', classCount: 20, paletteId: 'neon', breaks: [3, 1] }))).toEqual([
      'layers[0].style.dataStyle.classCount',
      'layers[0].style.dataStyle.paletteId',
      'layers[0].style.dataStyle.breaks',
    ]);
    expect(errors(withStyle({ kind: 'choropleth', attribute: 'pop', method: 'manual' }))).toEqual(['layers[0].style.dataStyle.breaks']);
    expect(
      errors(withStyle({ kind: 'categorical', attribute: 'type', categories: [{ value: 'city', color: 'red' }, { value: 'city', color: '#00ff00' }, { value: 1 }] })),
    ).toEqual([
      'layers[0].style.dataStyle.categories[0].color',
      'layers[0].style.dataStyle.categories[1].value',
      'layers[0].style.dataStyle.categories[2]',
    ]);
  });

  it('warns — without blocking — about styles that open but will look wrong', () => {
    const withStyle = (style: unknown) => ({ version: 1, layers: [layer({ style })] });
    // A project saved by the app may reference an attribute the user later removed.
    expect(errors(withStyle({ dataStyle: { kind: 'choropleth', attribute: 'gdp' } }))).toEqual([]);
    expect(warnings(withStyle({ dataStyle: { kind: 'choropleth', attribute: 'gdp' } }))).toEqual(['layers[0].style.dataStyle.attribute']);
    expect(warnings(withStyle({ dataStyle: { kind: 'proportional', attribute: 'name' } }))).toEqual(['layers[0].style.dataStyle.attribute']);
    expect(warnings(withStyle({ labels: { attribute: 'title' } }))).toEqual(['layers[0].style.labels.attribute']);
    expect(
      warnings(withStyle({ dataStyle: { kind: 'categorical', attribute: 'type', categories: [{ value: 'Capital', color: '#ff0000' }] } })),
    ).toEqual(['layers[0].style.dataStyle.categories[0].value']);
  });

  it('checks annotations and their links', () => {
    const withAnnotations = (...annotations: unknown[]) => ({ version: 1, layers: [layer()], annotations });
    expect(errors(withAnnotations({ kind: 'sticker' }))).toEqual(['annotations[0].kind']);
    expect(errors(withAnnotations({ kind: 'pin', anchorMode: 'map' }))).toEqual(['annotations[0].geoAnchor']);
    expect(errors(withAnnotations({ kind: 'legend' }))).toEqual(['annotations[0]']);
    expect(errors(withAnnotations({ kind: 'legend', dataStyleLink: { layerId: 'nope' } }))).toEqual(['annotations[0].dataStyleLink.layerId']);
    expect(errors(withAnnotations({ kind: 'text', text: 5, position: { x: '1' }, opacity: 3 }))).toEqual([
      'annotations[0].opacity', 'annotations[0].position', 'annotations[0].text',
    ]);
    expect(errors(withAnnotations({ kind: 'text', id: 'a' }, { kind: 'text', id: 'a' }))).toEqual(['annotations[1].id']);
  });
});

describe('checkFeatureCollection', () => {
  it('flags coordinates that are not WGS84 degrees, a handful at a time', () => {
    const projected = collection(...Array.from({ length: 9 }, () => point({}, [652000, 6862000])));
    const { issues } = checkFeatureCollection(projected, 'data');
    expect(issues).toHaveLength(6);
    expect(issues[0]).toMatchObject({ severity: 'warning', path: 'data.features[0].geometry.coordinates' });
    expect(issues[0].message).toContain('not projected meters');
    expect(issues[5].message).toBe('4 more feature problem(s) not listed');
  });

  it('reports attributes with whether they hold numbers', () => {
    const { issues, attributes } = checkFeatureCollection(
      collection(point({ name: 'A', pop: '12', tags: ['x'] }), { type: 'Feature', properties: null, geometry: null }),
      'data',
    );
    expect(issues.map((i) => `${i.severity} ${i.path}`)).toEqual(['warning data.features[0].properties.tags']);
    expect(attributes.get('pop')?.numeric).toBe(true);
    expect(attributes.get('name')?.numeric).toBe(false);
  });

  it('warns about an empty collection and an ignored crs', () => {
    const { issues } = checkFeatureCollection({ type: 'FeatureCollection', features: [], crs: {} }, 'data');
    expect(issues.map((i) => i.path)).toEqual(['data.features', 'data.crs']);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
  });
});
