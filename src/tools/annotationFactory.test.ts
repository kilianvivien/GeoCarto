import { describe, expect, it } from 'vitest';
import { DEFAULT_ANNOTATION_STYLE } from '@/project/cartoproj';
import { createAnnotation } from './annotationFactory';

const seed = {
  anchorMode: 'canvas' as const,
  position: { x: 100, y: 80 },
  geoAnchor: null,
  style: DEFAULT_ANNOTATION_STYLE,
};

describe('createAnnotation new kinds', () => {
  it('creates an image with empty src and default dimensions', () => {
    const annotation = createAnnotation({ ...seed, kind: 'image' });
    expect(annotation.kind).toBe('image');
    if (annotation.kind !== 'image') return;
    expect(annotation.src).toBe('');
    expect(annotation.width).toBeGreaterThan(0);
    expect(annotation.height).toBeGreaterThan(0);
  });

  it('creates a legend with sample entries', () => {
    const annotation = createAnnotation({ ...seed, kind: 'legend' });
    expect(annotation.kind).toBe('legend');
    if (annotation.kind !== 'legend') return;
    expect(annotation.entries.length).toBeGreaterThan(0);
    expect(annotation.entries[0].fillStyle).toMatchObject({ fillColor: '#007aff', fillPattern: 'none' });
    expect(annotation.title).toBe('Legend');
  });

  it('creates a comment with empty text and a timestamp', () => {
    const annotation = createAnnotation({ ...seed, kind: 'comment' });
    expect(annotation.kind).toBe('comment');
    if (annotation.kind !== 'comment') return;
    expect(annotation.text).toBe('');
    expect(annotation.createdAt).toBeTruthy();
  });
});
