import { describe, expect, it } from 'vitest';
import {
  brushOutlinePoints,
  hasPressureProfile,
  normalizePressure,
  outlineToSvgPath,
} from './brushStroke';

function strokeWidthAt(outline: number[], x: number): number {
  // Vertical extent of the outline near a given x — a proxy for stroke width
  // on a horizontal stroke.
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < outline.length; i += 2) {
    if (Math.abs(outline[i] - x) > 12) continue;
    minY = Math.min(minY, outline[i + 1]);
    maxY = Math.max(maxY, outline[i + 1]);
  }
  return maxY - minY;
}

describe('normalizePressure', () => {
  it('defaults unknown or zero pressure to mid pressure', () => {
    expect(normalizePressure(undefined)).toBe(0.5);
    expect(normalizePressure(0)).toBe(0.5);
    expect(normalizePressure(Number.NaN)).toBe(0.5);
  });

  it('clamps to at most 1 and keeps real values', () => {
    expect(normalizePressure(2)).toBe(1);
    expect(normalizePressure(0.3)).toBe(0.3);
  });
});

describe('hasPressureProfile', () => {
  it('rejects missing, mismatched, or flat profiles', () => {
    expect(hasPressureProfile([0, 0, 10, 0], undefined)).toBe(false);
    expect(hasPressureProfile([0, 0, 10, 0], [0.5])).toBe(false);
    expect(hasPressureProfile([0, 0, 10, 0, 20, 0], [0.5, 0.5])).toBe(false);
    expect(hasPressureProfile([0, 0, 10, 0], [0.5, 0.5])).toBe(false);
  });

  it('accepts a varying per-point profile', () => {
    expect(hasPressureProfile([0, 0, 10, 0], [0.2, 0.8])).toBe(true);
  });
});

describe('brushOutlinePoints', () => {
  // A realistic stroke: a horizontal line densely sampled every 10 px, like
  // the paint tool records.
  const denseStroke = (profile: (t: number) => number) => {
    const points: number[] = [];
    const pressures: number[] = [];
    for (let index = 0; index <= 20; index += 1) {
      points.push(index * 10, 0);
      pressures.push(profile(index / 20));
    }
    return { points, pressures };
  };

  it('produces a closed polygon that is wider where pressure is higher', () => {
    const { points, pressures } = denseStroke((t) => 0.15 + 0.8 * Math.sin(Math.PI * t));
    const outline = brushOutlinePoints(points, pressures, 8, 'round');
    expect(outline.length).toBeGreaterThan(12);
    expect(outline.length % 2).toBe(0);
    const midWidth = strokeWidthAt(outline, 100);
    const endWidth = strokeWidthAt(outline, 10);
    expect(midWidth).toBeGreaterThan(endWidth * 1.5);
  });

  it('matches the uniform preset width at mid pressure', () => {
    const { points, pressures } = denseStroke(() => 0.5);
    const outline = brushOutlinePoints(points, pressures, 10, 'round');
    expect(strokeWidthAt(outline, 100)).toBeCloseTo(10, 0);
  });

  it('scales with the preset multiplier and halo padding', () => {
    const { points, pressures } = denseStroke(() => 0.5);
    const round = brushOutlinePoints(points, pressures, 10, 'round');
    const highlighter = brushOutlinePoints(points, pressures, 10, 'highlighter');
    expect(strokeWidthAt(highlighter, 100)).toBeGreaterThan(strokeWidthAt(round, 100) * 2.5);

    const halo = brushOutlinePoints(points, pressures, 10, 'round', 3);
    expect(strokeWidthAt(halo, 100)).toBeCloseTo(strokeWidthAt(round, 100) + 6, 0);
  });
});

describe('outlineToSvgPath', () => {
  it('builds a closed quadratic path from the outline', () => {
    const path = outlineToSvgPath([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(path.startsWith('M0 0 Q')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });

  it('returns an empty string for degenerate outlines', () => {
    expect(outlineToSvgPath([0, 0, 1, 1])).toBe('');
  });
});
