import { describe, expect, it } from 'vitest';
import { PAGE_PRESETS, PAGE_PRESET_BY_KEY, detectPreset } from './pagePresets';

describe('page presets', () => {
  it('lists each preset key uniquely', () => {
    const keys = PAGE_PRESETS.map((preset) => preset.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('A4 landscape swaps the portrait dimensions', () => {
    const portrait = PAGE_PRESET_BY_KEY['a4-portrait'];
    const landscape = PAGE_PRESET_BY_KEY['a4-landscape'];
    expect(landscape.width).toBe(portrait.height);
    expect(landscape.height).toBe(portrait.width);
  });

  it('detects a known preset by dimensions', () => {
    const a3 = PAGE_PRESET_BY_KEY['a3-portrait'];
    expect(detectPreset(a3.width, a3.height)).toBe('a3-portrait');
  });

  it('returns "custom" for unknown dimensions', () => {
    expect(detectPreset(1234, 567)).toBe('custom');
  });
});
