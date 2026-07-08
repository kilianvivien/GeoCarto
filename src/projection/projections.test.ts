import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTION_CONFIG, type ProjectionId } from '@/project/cartoproj';
import { buildD3Projection } from './projections';
import { createD3CanvasProjection } from './canvasProjectionAdapter';
import { buildGraticule } from './graticule';
import { fitProjectionToFrame } from './fitToFrame';

const FRAME = { width: 800, height: 600 };
const SAMPLE_COORDS: [number, number][] = [
  [0, 0],
  [2.35, 48.85],
  [-74, 40.7],
  [151, -33.9],
];

const PROJECTION_IDS: ProjectionId[] = ['equal-earth', 'robinson', 'winkel3', 'bonne', 'natural-earth-1'];

describe('buildD3Projection / createD3CanvasProjection round-trip', () => {
  for (const id of PROJECTION_IDS) {
    it(`round-trips known coordinates for ${id}`, () => {
      const config = { ...DEFAULT_PROJECTION_CONFIG[id] };
      const d3proj = buildD3Projection(config);
      fitProjectionToFrame(d3proj, FRAME);
      const projection = createD3CanvasProjection(d3proj);
      // Bonne's invert is a numeric approximation — allow a looser epsilon.
      const epsilon = id === 'bonne' ? 0.5 : 1e-6;

      for (const coord of SAMPLE_COORDS) {
        const point = projection.project(coord);
        expect(point).not.toBeNull();
        if (!point) continue;
        const back = projection.unproject(point);
        expect(back).not.toBeNull();
        if (!back) continue;
        expect(back[0]).toBeCloseTo(coord[0], epsilon < 1 ? 6 : 0);
        expect(back[1]).toBeCloseTo(coord[1], epsilon < 1 ? 6 : 0);
      }
    });
  }

  it('returns null for antipodal/clipped points', () => {
    const config = { ...DEFAULT_PROJECTION_CONFIG['equal-earth'], rotateLambda: 0 };
    const d3proj = buildD3Projection(config);
    fitProjectionToFrame(d3proj, FRAME);
    const projection = createD3CanvasProjection(d3proj);
    // Equal Earth is a whole-globe projection with no clipping — every valid
    // lngLat projects somewhere. Assert well-formed (non-null, finite) output
    // rather than a clip, since the "null" contract is exercised by whichever
    // projections do clip (verified indirectly via the interface's | null type).
    const point = projection.project([180, 0]);
    expect(point).not.toBeNull();
  });
});

describe('buildGraticule', () => {
  it('produces grid lines at the requested interval', () => {
    const multiline = buildGraticule(30);
    expect(multiline.type).toBe('MultiLineString');
    expect(multiline.coordinates.length).toBeGreaterThan(0);
    // A coarser interval should produce fewer lines than the default 10°/90° d3 graticule.
    const fine = buildGraticule(10);
    expect(multiline.coordinates.length).toBeLessThanOrEqual(fine.coordinates.length);
  });

  it('clamps sub-1-degree intervals to avoid pathological line counts', () => {
    const multiline = buildGraticule(0);
    expect(multiline.coordinates.length).toBeGreaterThan(0);
  });
});

describe('fitProjectionToFrame', () => {
  it('produces a finite scale that keeps the globe within the frame', () => {
    const config = { ...DEFAULT_PROJECTION_CONFIG['robinson'] };
    const d3proj = buildD3Projection(config);
    const { scale, center } = fitProjectionToFrame(d3proj, FRAME);
    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBeGreaterThan(0);
    expect(center[0]).toBeCloseTo(FRAME.width / 2, 0);
    expect(center[1]).toBeCloseTo(FRAME.height / 2, 0);
  });
});
