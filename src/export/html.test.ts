import { describe, expect, it, vi } from 'vitest';
import { createEmptyProject, DEFAULT_GEOJSON_STYLE } from '@/project/cartoproj';

vi.mock('./svg', () => ({
  exportSvg: vi.fn(async () => ({
    blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><text>Overlay</text></svg>'], { type: 'image/svg+xml' }),
    fileName: 'overlay.svg',
    width: 800,
    height: 600,
  })),
}));

describe('interactive HTML export', () => {
  it('inlines the runtime, GeoJSON, interaction options, tooltips, and overlays', async () => {
    const project = createEmptyProject('Interactive map');
    project.layers.push({
      id: 'cities', kind: 'geojson', name: 'Cities', visible: true, locked: false,
      geometry: 'point', featureCount: 1, renderStrategy: 'vector',
      data: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Paris' }, geometry: { type: 'Point', coordinates: [2.35, 48.85] } }] },
      style: { ...DEFAULT_GEOJSON_STYLE },
    });
    const { exportHtml } = await import('./html');
    const result = await exportHtml(project, {
      panZoom: false,
      minZoom: 1,
      maxZoom: 12,
      tooltipProperties: { cities: ['name'] },
    });
    const html = await result.blob.text();
    expect(result.fileName).toBe('Interactive map.html');
    expect(html).toContain('maplibregl.Map');
    expect(html).toContain('Paris');
    expect(html).toContain('Overlay');
    expect(html).toContain('"panZoom":false');
    expect(html).not.toContain('<script src=');
  });
});
