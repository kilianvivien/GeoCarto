import { describe, expect, it } from 'vitest';
import { DEFAULT_ANNOTATION_STYLE, type Annotation } from '@/project/cartoproj';
import { applyAnnotationTransform } from './annotationTransforms';

const base = {
  id: 'a1',
  name: 'Shape',
  visible: true,
  locked: false,
  anchorMode: 'canvas',
  position: { x: 10, y: 20 },
  geoAnchor: null,
  rotation: 0,
  opacity: 1,
  style: { ...DEFAULT_ANNOTATION_STYLE },
} satisfies Omit<Annotation, 'kind'>;

describe('applyAnnotationTransform', () => {
  it('bakes rectangle scale into width and height', () => {
    const annotation: Annotation = {
      ...base,
      kind: 'rectangle',
      width: 100,
      height: 80,
      cornerRadius: 8,
    };

    expect(
      applyAnnotationTransform(annotation, {
        position: { x: 25, y: 35 },
        rotation: 12,
        scaleX: 1.5,
        scaleY: 0.5,
      }),
    ).toMatchObject({
      position: { x: 25, y: 35 },
      rotation: 12,
      width: 150,
      height: 40,
    });
  });

  it('bakes ellipse scale independently into both radii', () => {
    const annotation: Annotation = {
      ...base,
      kind: 'ellipse',
      radiusX: 60,
      radiusY: 30,
    };

    expect(
      applyAnnotationTransform(annotation, {
        position: { x: 0, y: 0 },
        rotation: 0,
        scaleX: 0.75,
        scaleY: 2,
      }),
    ).toMatchObject({ radiusX: 45, radiusY: 60 });
  });

  it('bakes line-like scale into every point pair', () => {
    const annotation: Annotation = {
      ...base,
      kind: 'polygon',
      points: [0, 0, 10, 20, -5, 4],
      closed: true,
    };

    expect(
      applyAnnotationTransform(annotation, {
        position: { x: 0, y: 0 },
        rotation: 0,
        scaleX: 2,
        scaleY: 3,
      }),
    ).toMatchObject({ points: [0, 0, 20, 60, -10, 12] });
  });
});
