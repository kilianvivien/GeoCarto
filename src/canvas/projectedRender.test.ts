import { describe, expect, it, vi } from 'vitest';
import type { GeoPath } from 'd3-geo';
import { DEFAULT_GEOJSON_STYLE, type GeoJsonLayer } from '@/project/cartoproj';
import { drawProjectedLabels } from './projectedRender';

/** Identity projection; `null` for the one position the test marks as clipped. */
const path = {
  projection: () => (point: [number, number]) => (point[0] === 999 ? null : point),
} as unknown as GeoPath;

function recordingContext() {
  const calls: string[] = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    strokeText: (text: string, x: number, y: number) => calls.push(`halo ${text} @${x},${y}`),
    fillText: (text: string, x: number, y: number) => calls.push(`text ${text} @${x},${y}`),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const layer = (halo: boolean): GeoJsonLayer => ({
  id: 'l', kind: 'geojson', name: 'L', visible: true, locked: false, geometry: 'point', featureCount: 2,
  data: {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { nom: 'Ville', taux: 5 }, geometry: { type: 'Point', coordinates: [100, 200] } },
      { type: 'Feature', properties: { nom: 'Antipode' }, geometry: { type: 'Point', coordinates: [999, 0] } },
    ],
  },
  style: {
    ...DEFAULT_GEOJSON_STYLE,
    pointRadius: 7,
    labels: { attribute: 'nom', valueAttribute: 'taux', size: 10, color: '#000000', halo },
  },
});

describe('drawProjectedLabels', () => {
  it('draws each line below the point symbol, halo first, and skips clipped positions', () => {
    const { ctx, calls } = recordingContext();
    drawProjectedLabels(ctx, path, layer(true));
    // Top of text = y + radius 7 + gap 3 = 210; 12px lines are centered at 216 and 228.
    expect(calls).toEqual(['halo Ville @100,216', 'text Ville @100,216', 'halo 5 @100,228', 'text 5 @100,228']);
    expect(ctx.font).toBe('10px "Helvetica Neue", Helvetica, Arial, sans-serif');
  });

  it('scales text and offsets for high-resolution export, and omits the halo when off', () => {
    const { ctx, calls } = recordingContext();
    drawProjectedLabels(ctx, path, layer(false), 2);
    expect(calls).toEqual(['text Ville @100,232', 'text 5 @100,256']);
    expect(ctx.font).toContain('20px');
  });

  it('draws nothing for a layer without labels', () => {
    const { ctx, calls } = recordingContext();
    drawProjectedLabels(ctx, path, { ...layer(true), style: { ...DEFAULT_GEOJSON_STYLE } });
    expect(calls).toEqual([]);
  });
});
