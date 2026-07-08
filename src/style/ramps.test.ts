import { describe, expect, it } from 'vitest';
import { COLOR_RAMPS, rampById, sampleRamp } from './ramps';

describe('rampById', () => {
  it('finds a known ramp and falls back to the first ramp for an unknown id', () => {
    expect(rampById('blues').name).toBe('Blues');
    expect(rampById('does-not-exist')).toBe(COLOR_RAMPS[0]);
  });
});

describe('sampleRamp', () => {
  it('returns exactly `count` colors, evenly spaced across the reference stops', () => {
    const colors = sampleRamp('blues', 5);
    expect(colors).toHaveLength(5);
    expect(colors[0]).toBe('#f7fbff');
    expect(colors[4]).toBe('#08306b');
  });

  it('returns the full 9-stop reference when count matches its length', () => {
    expect(sampleRamp('blues', 9)).toEqual(rampById('blues').colors);
  });

  it('reverses the sampled colors when asked', () => {
    const forward = sampleRamp('blues', 3);
    const reversed = sampleRamp('blues', 3, true);
    expect(reversed).toEqual([...forward].reverse());
  });

  it('returns a single midpoint color for a 1-class request', () => {
    expect(sampleRamp('blues', 1)).toHaveLength(1);
  });
});

describe('COLOR_RAMPS catalog', () => {
  it('every ramp has at least 8 reference stops and a defined kind', () => {
    for (const ramp of COLOR_RAMPS) {
      expect(ramp.colors.length).toBeGreaterThanOrEqual(8);
      expect(['sequential', 'diverging', 'categorical']).toContain(ramp.kind);
    }
  });
});
