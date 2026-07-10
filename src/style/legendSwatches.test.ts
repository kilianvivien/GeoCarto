import { describe, expect, it } from 'vitest';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { createAnnotation } from '@/tools/annotationFactory';
import { legendSymbolFromAnnotation, proportionalLegendEntries } from './legendSwatches';

const seed = {
  anchorMode: 'canvas' as const,
  position: { x: 0, y: 0 },
  geoAnchor: null,
  style: {
    ...DEFAULT_ANNOTATION_STYLE,
    fillColor: '#34c759',
    fillPattern: 'diagonal' as const,
    hatchColor: '#111827',
    hatchSpacing: 12,
    strokeColor: '#ff9500',
    strokeWidth: 5,
    strokePattern: 'dashed' as const,
    brushPreset: 'marker' as const,
    pinColor: '#af52de',
    pinIcon: 'star' as const,
  },
};

describe('legendSymbolFromAnnotation', () => {
  it('derives fill symbols from filled shapes', () => {
    const annotation = createAnnotation({ ...seed, kind: 'rectangle' });
    expect(legendSymbolFromAnnotation(annotation)).toEqual({
      kind: 'fill',
      fillColor: '#34c759',
      fillPattern: 'diagonal',
      hatchColor: '#111827',
      hatchSpacing: 12,
    });
  });

  it('derives line, brush, arrow, and measurement symbols from stroke annotations', () => {
    const line = createAnnotation({ ...seed, kind: 'line' });
    const arrow = createAnnotation({ ...seed, kind: 'arrow' });
    const measurement = createAnnotation({ ...seed, kind: 'measurement' });

    expect(legendSymbolFromAnnotation(line)).toMatchObject({
      kind: 'line',
      strokeColor: '#ff9500',
      strokeWidth: 5,
      strokePattern: 'dashed',
      brushPreset: 'marker',
    });
    expect(legendSymbolFromAnnotation(arrow)).toMatchObject({ kind: 'arrow', strokeColor: '#ff9500' });
    expect(legendSymbolFromAnnotation(measurement)).toMatchObject({ kind: 'measurement', strokeColor: '#ff9500' });
  });

  it('derives pin symbols and ignores non-legendable annotations', () => {
    const pin = createAnnotation({ ...seed, kind: 'pin' });
    const text = createAnnotation({ ...seed, kind: 'text' });

    expect(legendSymbolFromAnnotation(pin)).toEqual({
      kind: 'pin',
      pinColor: '#af52de',
      pinIcon: 'star',
    });
    expect(legendSymbolFromAnnotation(text)).toBeNull();
  });
});

describe('proportionalLegendEntries', () => {
  it('materializes graduated circle symbols for min, midpoint, and max values', () => {
    const entries = proportionalLegendEntries({
      kind: 'proportional', attribute: 'population', minRadius: 4, maxRadius: 24, scale: 'sqrt', color: '#007aff',
    }, 0, 100);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.symbol?.kind)).toEqual(['circle', 'circle', 'circle']);
    expect(entries[0].symbol).toMatchObject({ radius: 4, maxRadius: 24 });
    expect(entries[2].symbol).toMatchObject({ radius: 24, maxRadius: 24 });
  });
});
