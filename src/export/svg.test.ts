import { afterEach, describe, expect, it } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import {
  createEmptyProject,
  DEFAULT_GEOJSON_STYLE,
  type Annotation,
  type CartoProject,
  type GeoJsonLayer,
} from '@/project/cartoproj';
import { createAnnotation } from '@/tools/annotationFactory';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { exportSvg, splitDataLayers } from './svg';

// Minimal stand-in for the live map: identity projection + a fixed container.
function stubMap(clientWidth = 1600, clientHeight = 1200): maplibregl.Map {
  return {
    project: (lngLat: [number, number]) => ({ x: lngLat[0], y: lngLat[1] }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    getCenter: () => ({ lng: 0, lat: 0 }),
    getContainer: () => ({ clientWidth, clientHeight }) as HTMLElement,
    getBearing: () => 0,
  } as unknown as maplibregl.Map;
}

function projectWith(annotations: Annotation[]): CartoProject {
  const project = createEmptyProject('Diagram');
  project.mode = 'editing';
  return { ...project, annotations };
}

function make(kind: Parameters<typeof createAnnotation>[0]['kind']): Annotation {
  return createAnnotation({
    kind,
    anchorMode: 'canvas',
    position: { x: 100, y: 100 },
    geoAnchor: null,
    style: { ...DEFAULT_ANNOTATION_STYLE },
  });
}

afterEach(() => useMapInstance.setState({ map: null, projection: null }));

function dataLayer(overrides: Partial<GeoJsonLayer> = {}): GeoJsonLayer {
  return {
    id: 'regions',
    kind: 'geojson',
    name: 'Régions 2024',
    visible: true,
    locked: false,
    geometry: 'polygon',
    featureCount: 2,
    renderStrategy: 'vector',
    data: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[[100, 100], [300, 100], [300, 200], [100, 100]]] },
        },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [400, 300] } },
      ],
    },
    style: { ...DEFAULT_GEOJSON_STYLE, fillColor: '#34c759', strokeWidth: 2 },
    ...overrides,
  };
}

describe('exportSvg vector data layers', () => {
  // Identity projection on an 800px-wide editor exporting a 1600px frame → 2× scale.
  const mercator = { kind: 'mercator' as const, project: ([x, y]: [number, number]) => ({ x, y }), unproject: () => null };

  it('draws Mercator data layers as named, frame-clipped vector paths', async () => {
    useMapInstance.setState({ map: stubMap(800, 600), projection: mercator });
    const project = { ...projectWith([]), layers: [dataLayer()] };

    const svg = await (await exportSvg(project, { includeBasemap: false, vectorData: true })).blob.text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(doc.querySelector('parsererror')).toBeNull();
    const group = doc.querySelector('#data-layers > g');
    expect(group?.getAttribute('id')).toBe('data-1-R-gions-2024');
    expect(doc.querySelector('#data-layers')?.getAttribute('clip-path')).toBe('url(#gc-data-clip)');
    const [polygon, point] = Array.from(group!.querySelectorAll('path'));
    // Vertices and stroke widths are scaled from editor pixels to frame units.
    expect(polygon.getAttribute('d')).toBe('M200,200L600,200L600,400Z');
    expect(polygon.getAttribute('fill')).toBe('#34c759');
    expect(polygon.getAttribute('stroke-width')).toBe('4');
    expect(point.getAttribute('d')).toContain('M800,600');
  });

  it('writes every label as editable text above the geometry, scaled with the frame', async () => {
    useMapInstance.setState({ map: stubMap(800, 600), projection: mercator });
    const layer = dataLayer();
    layer.data.features[0].properties = { nom: 'Zone & Co', taux: 12.5 };
    layer.data.features[1].properties = { nom: 'Ville', taux: 3 };
    layer.style.labels = { attribute: 'nom', valueAttribute: 'taux', valueSuffix: ' %', size: 10, color: '#112233', halo: true };
    const project = { ...projectWith([]), layers: [layer] };

    const svg = await (await exportSvg(project, { includeBasemap: false, vectorData: true })).blob.text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(doc.querySelector('parsererror')).toBeNull();
    const group = doc.querySelector('#data-layers > #data-labels > g');
    expect(group?.getAttribute('id')).toBe('labels-1-R-gions-2024');
    // Geometry first, labels after: text is never hidden under a fill.
    expect(doc.querySelector('#data-layers')?.lastElementChild?.getAttribute('id')).toBe('data-labels');
    const style = group!.firstElementChild!;
    expect(style.getAttribute('font-size')).toBe('20');
    expect(style.getAttribute('fill')).toBe('#112233');
    expect(style.getAttribute('paint-order')).toBe('stroke');
    const texts = Array.from(group!.querySelectorAll('text'));
    expect(texts.map((text) => Array.from(text.querySelectorAll('tspan')).map((span) => span.textContent))).toEqual([
      ['Zone & Co', '12.5 %'],
      ['Ville', '3 %'],
    ]);
    // The point's label hangs below its (scaled) symbol rather than covering it.
    const pointSpan = texts[1].querySelector('tspan')!;
    expect(pointSpan.getAttribute('x')).toBe('800');
    expect(Number(pointSpan.getAttribute('y'))).toBeGreaterThan(600 + DEFAULT_GEOJSON_STYLE.pointRadius * 2);
  });

  it('leaves heatmap and hidden layers out of the vector output', async () => {
    useMapInstance.setState({ map: stubMap(800, 600), projection: mercator });
    const layers = [dataLayer({ id: 'heat', renderStrategy: 'heatmap' }), dataLayer({ id: 'hidden', visible: false })];
    const project = { ...projectWith([]), layers };

    expect(splitDataLayers(project, true, mercator)).toEqual({ vector: [], raster: layers });
    const svg = await (await exportSvg(project, { includeBasemap: false, vectorData: true })).blob.text();
    expect(svg).not.toContain('data-layers');
  });

  it('keeps every layer in the raster when vector data is off or no map projection exists', () => {
    const project = { ...projectWith([]), layers: [dataLayer()] };
    expect(splitDataLayers(project, false, mercator).vector).toEqual([]);
    expect(splitDataLayers(project, true, null).vector).toEqual([]);
    expect(splitDataLayers(project, true, mercator).vector).toHaveLength(1);
  });

  it('does not vectorize data over a static-image basemap, which hides the map', () => {
    const project: CartoProject = {
      ...projectWith([]),
      layers: [dataLayer()],
      basemap: { kind: 'static', name: 'Scan', mediaType: 'image', mimeType: 'image/png', dataUrl: 'data:,', attribution: '' },
    };
    expect(splitDataLayers(project, true, mercator).vector).toEqual([]);
  });
});

describe('exportSvg', () => {
  it('produces a well-formed SVG with editable vector primitives', async () => {
    useMapInstance.setState({ map: stubMap() });
    const project = projectWith([
      make('text'),
      make('rectangle'),
      make('titleblock'),
      make('scalebar'),
      make('northarrow'),
    ]);

    const result = await exportSvg(project, { includeBasemap: false });
    const svg = await result.blob.text();

    expect(result.fileName).toBe('Diagram.svg');
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 1600 1200');
    // text annotation + title block title + scale bar label + "N" → multiple <text>.
    expect(doc.querySelectorAll('text').length).toBeGreaterThanOrEqual(4);
    expect(doc.querySelector('rect')).not.toBeNull();
    // No basemap requested → no embedded raster image.
    expect(doc.querySelector('image')).toBeNull();
  });

  it('escapes text content to keep the SVG well-formed', async () => {
    useMapInstance.setState({ map: stubMap() });
    const text = make('text');
    if (text.kind !== 'text') throw new Error('expected text');
    text.text = 'A & B < C > "D"';
    const result = await exportSvg(projectWith([text]), { includeBasemap: false });
    const svg = await result.blob.text();
    expect(svg).toContain('A &amp; B &lt; C &gt;');
    expect(
      new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror'),
    ).toBeNull();
  });

  it('scales annotation origins uniformly on both axes (matches the raster layer)', async () => {
    // Container aspect (1000×600, 5:3) differs from the frame (1600×1200, 4:3) —
    // the normal case after lock. Both axes must use frameW/containerW = 1.6;
    // a separate Y factor (1200/600 = 2) would offset annotations vertically.
    useMapInstance.setState({ map: stubMap(1000, 600) });
    const rect = make('rectangle');
    rect.position = { x: 100, y: 100 };
    const result = await exportSvg(projectWith([rect]), { includeBasemap: false });
    const svg = await result.blob.text();
    const transform = svg.match(/<g transform="translate\(([\d.]+),([\d.]+)\)/);
    expect(transform).not.toBeNull();
    const [, tx, ty] = transform!;
    expect(Number(tx)).toBeCloseTo(160); // 100 * 1.6
    expect(Number(ty)).toBeCloseTo(160); // uniform — NOT 100 * 2 = 200
  });

  it('exports hatch fills as clipped vector strokes', async () => {
    useMapInstance.setState({ map: stubMap() });
    const polygon = make('polygon');
    if (polygon.kind !== 'polygon') throw new Error('expected polygon');
    polygon.style.fillPattern = 'diagonal';
    polygon.style.hatchColor = '#663300';
    polygon.style.hatchSpacing = 8;

    const result = await exportSvg(projectWith([polygon]), { includeBasemap: false });
    const svg = await result.blob.text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('clipPath[id^="gc-hatch-"] polygon')).not.toBeNull();
    expect(
      [...doc.querySelectorAll('g[clip-path] line')].some(
        (line) => line.getAttribute('stroke') === '#663300',
      ),
    ).toBe(true);
  });

  it('omits comment pins from exported artwork', async () => {
    useMapInstance.setState({ map: stubMap() });
    const result = await exportSvg(projectWith([make('comment')]), { includeBasemap: false });
    const svg = await result.blob.text();
    // Comment renders nothing → only the background rect, no annotation group.
    expect(svg).not.toContain('<g ');
  });

  it('exports brush strokes with the preset width and pressure strokes as filled outlines', async () => {
    useMapInstance.setState({ map: stubMap() });
    const uniform: Annotation = {
      ...make('line'),
      lineRole: 'brush',
      points: [0, 0, 60, 0, 120, 10],
      style: { ...DEFAULT_ANNOTATION_STYLE, strokeWidth: 10, brushPreset: 'marker' },
    } as Annotation;
    const pressured: Annotation = {
      ...make('line'),
      id: 'pressure-stroke',
      lineRole: 'brush',
      points: [0, 0, 60, 0, 120, 10],
      pressures: [0.2, 0.9, 0.4],
    } as Annotation;

    const result = await exportSvg(projectWith([uniform, pressured]), { includeBasemap: false });
    const svg = await result.blob.text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');

    // Uniform brush: a stroked polyline at the marker preset width (10 × 1.8).
    const polyline = doc.querySelector('polyline[stroke-width="18"]');
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute('opacity')).toBe('0.78');

    // Pressure stroke: a filled closed path, no stroke width at all.
    const path = [...doc.querySelectorAll('path')].find((el) => el.getAttribute('d')?.endsWith('Z'));
    expect(path).not.toBeNull();
    expect(path?.getAttribute('fill')).toBe(DEFAULT_ANNOTATION_STYLE.strokeColor);
  });
});
