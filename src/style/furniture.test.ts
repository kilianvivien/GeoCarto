import { describe, expect, it } from 'vitest';
import { niceNumber, niceScaleBar } from './furniture';

describe('niceNumber', () => {
  it('rounds down to 1 / 2 / 5 × 10ⁿ', () => {
    expect(niceNumber(7)).toBe(5);
    expect(niceNumber(4)).toBe(2);
    expect(niceNumber(1.4)).toBe(1);
    expect(niceNumber(340)).toBe(200);
    expect(niceNumber(900)).toBe(500);
    expect(niceNumber(1200)).toBe(1000);
  });

  it('handles non-positive input', () => {
    expect(niceNumber(0)).toBe(0);
    expect(niceNumber(-5)).toBe(0);
  });
});

describe('niceScaleBar', () => {
  it('produces a round metric distance no wider than the cap', () => {
    // 10 m/px over a 140 px cap → up to 1400 m → snaps to 1 km.
    const tick = niceScaleBar(10, 140, 'metric');
    expect(tick.label).toBe('1 km');
    expect(tick.lengthPx).toBeCloseTo(100); // 1000 m / 10 m/px
    expect(tick.lengthPx).toBeLessThanOrEqual(140);
  });

  it('stays in metres below 1 km', () => {
    // 2 m/px over 140 px → up to 280 m → snaps to 200 m.
    const tick = niceScaleBar(2, 140, 'metric');
    expect(tick.label).toBe('200 m');
    expect(tick.lengthPx).toBeCloseTo(100);
  });

  it('switches to miles for large imperial distances', () => {
    // 10 m/px ≈ 32.8 ft/px over 140 px → ~4593 ft → still feet? 4593 < 5280 → feet.
    const small = niceScaleBar(10, 140, 'imperial');
    expect(small.label).toMatch(/ft$/);
    // 50 m/px → much larger → miles.
    const big = niceScaleBar(50, 140, 'imperial');
    expect(big.label).toMatch(/mi$/);
  });

  it('returns an empty tick for an invalid scale', () => {
    expect(niceScaleBar(0, 140, 'metric')).toEqual({ lengthPx: 0, label: '' });
  });
});
