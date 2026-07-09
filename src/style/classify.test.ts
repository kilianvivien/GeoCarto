import { describe, expect, it } from 'vitest';
import type { Feature } from 'geojson';
import { computeBreaks, dedupeAscending, listAllAttributes, listNumericAttributes, scanAttribute } from './classify';

function feature(properties: Record<string, unknown>): Feature {
  return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [0, 0] } };
}

describe('scanAttribute', () => {
  it('coerces numeric strings and counts missing values', () => {
    const features = [feature({ pop: 10 }), feature({ pop: '20' }), feature({ pop: null }), feature({})];
    const stats = scanAttribute(features, 'pop');
    expect(stats.values).toEqual([10, 20]);
    expect(stats.missingCount).toBe(2);
    expect(stats.totalCount).toBe(4);
  });

  it('treats non-numeric strings as missing', () => {
    const stats = scanAttribute([feature({ name: 'Paris' })], 'name');
    expect(stats.values).toEqual([]);
    expect(stats.missingCount).toBe(1);
  });
});

describe('listNumericAttributes / listAllAttributes', () => {
  it('finds attributes with at least one numeric value, excluding the fill key', () => {
    const features = [feature({ '@id': 'a', pop: 10, name: 'A' }), feature({ '@id': 'b', pop: 'x', name: 'B' })];
    expect(listNumericAttributes(features)).toEqual(['pop']);
    expect(listAllAttributes(features)).toEqual(['name', 'pop']);
  });
});

describe('computeBreaks', () => {
  it('returns no breaks for fewer than 2 distinct values', () => {
    expect(computeBreaks([5, 5, 5], 'equal', 4)).toEqual([]);
    expect(computeBreaks([], 'quantile', 4)).toEqual([]);
  });

  it('computes equal-interval breaks over a known range', () => {
    const values = [0, 25, 50, 75, 100];
    expect(computeBreaks(values, 'equal', 4)).toEqual([25, 50, 75]);
  });

  it('computes quantile breaks that split the sorted data evenly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const breaks = computeBreaks(values, 'quantile', 2);
    expect(breaks).toHaveLength(1);
    expect(breaks[0]).toBeCloseTo(5.5, 5);
  });

  it('clamps class count to the number of distinct values', () => {
    // Only 2 distinct values — a 5-class request degrades to a 1-break split.
    const breaks = computeBreaks([1, 1, 1, 2, 2], 'equal', 5);
    expect(breaks).toEqual([1.5]);
  });

  it('computes jenks natural breaks producing ascending, in-range boundaries', () => {
    const values = [1, 2, 3, 10, 11, 12, 50, 51, 52];
    const breaks = computeBreaks(values, 'jenks', 3);
    expect(breaks).toHaveLength(2);
    expect(breaks[0]).toBeGreaterThan(3);
    expect(breaks[0]).toBeLessThan(10);
    expect(breaks[1]).toBeGreaterThan(12);
    expect(breaks[1]).toBeLessThan(50);
  });

  it('handles jenks on a large dataset via sampling without throwing', () => {
    const values = Array.from({ length: 5000 }, (_, i) => i);
    const breaks = computeBreaks(values, 'jenks', 5);
    expect(breaks).toHaveLength(4);
    for (let i = 1; i < breaks.length; i++) expect(breaks[i]).toBeGreaterThan(breaks[i - 1]);
  });

  it('deduplicates quantile breaks on skewed/discrete data instead of returning repeated stops', () => {
    // 7 copies of 1, then 2,3,4,5 — 5 distinct values, so classCount=5 is not
    // clamped, but a naive interpolated-quantile split lands three of the four
    // break points inside the repeated run of 1s.
    const values = [1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5];
    const breaks = computeBreaks(values, 'quantile', 5);
    for (let i = 1; i < breaks.length; i++) expect(breaks[i]).toBeGreaterThan(breaks[i - 1]);
  });
});

describe('dedupeAscending', () => {
  it('drops non-increasing entries, keeping the first occurrence of each run', () => {
    expect(dedupeAscending([1, 1, 1, 3])).toEqual([1, 3]);
    expect(dedupeAscending([1, 2, 3])).toEqual([1, 2, 3]);
    expect(dedupeAscending([])).toEqual([]);
    expect(dedupeAscending([5, 4])).toEqual([5]); // non-ascending input: only strictly-increasing steps survive
  });
});
