import { afterEach, describe, expect, it } from 'vitest';
import type maplibregl from 'maplibre-gl';
import { createEmptyProject, type Annotation, type CartoProject } from '@/project/cartoproj';
import { createAnnotation } from '@/tools/annotationFactory';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { exportSvg } from './svg';

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

afterEach(() => useMapInstance.setState({ map: null }));

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
