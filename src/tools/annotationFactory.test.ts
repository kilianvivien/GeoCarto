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

  it('creates a title block with title and subtitle', () => {
    const annotation = createAnnotation({ ...seed, kind: 'titleblock' });
    expect(annotation.kind).toBe('titleblock');
    if (annotation.kind !== 'titleblock') return;
    expect(annotation.title).toBeTruthy();
    expect(annotation.width).toBeGreaterThan(0);
  });

  it('creates a scale bar defaulting to metric', () => {
    const annotation = createAnnotation({ ...seed, kind: 'scalebar' });
    expect(annotation.kind).toBe('scalebar');
    if (annotation.kind !== 'scalebar') return;
    expect(annotation.unitSystem).toBe('metric');
    expect(annotation.maxWidth).toBeGreaterThan(0);
  });

  it('creates a north arrow with a positive size', () => {
    const annotation = createAnnotation({ ...seed, kind: 'northarrow' });
    expect(annotation.kind).toBe('northarrow');
    if (annotation.kind !== 'northarrow') return;
    expect(annotation.size).toBeGreaterThan(0);
  });
});
