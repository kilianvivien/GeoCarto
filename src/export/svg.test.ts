import { afterEach, describe, expect, it } from 'vitest';
import type maplibregl from 'maplibre-gl';
import { createEmptyProject, type Annotation, type CartoProject } from '@/project/cartoproj';
import { createAnnotation } from '@/tools/annotationFactory';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { useMapInstance } from '@/canvas/mapInstance';
import { exportSvg } from './svg';

// Minimal stand-in for the live map: identity projection + a fixed container.
function stubMap(): maplibregl.Map {
  return {
    project: (lngLat: [number, number]) => ({ x: lngLat[0], y: lngLat[1] }),
    unproject: ([x, y]: [number, number]) => ({ lng: x, lat: y }),
    getCenter: () => ({ lng: 0, lat: 0 }),
    getContainer: () => ({ clientWidth: 1600, clientHeight: 1200 }) as HTMLElement,
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
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  });

  it('omits comment pins from exported artwork', async () => {
    useMapInstance.setState({ map: stubMap() });
    const result = await exportSvg(projectWith([make('comment')]), { includeBasemap: false });
    const svg = await result.blob.text();
    // Comment renders nothing → only the background rect, no annotation group.
    expect(svg).not.toContain('<g ');
  });
});
