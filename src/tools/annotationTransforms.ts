import type { Annotation } from '@/project/cartoproj';

const MIN_SIZE = 4;

function scalePoints(points: number[], scaleX: number, scaleY: number) {
  return points.map((value, index) => value * (index % 2 === 0 ? scaleX : scaleY));
}

function absScaled(value: number, scale: number) {
  return Math.max(MIN_SIZE, Math.abs(value * scale));
}

/**
 * Konva Transformer writes transient scale onto the selected node. Fold that
 * scale into the canonical annotation geometry so remounting (hide/show,
 * selection changes, export) preserves the edited size.
 */
export function applyAnnotationTransform(
  annotation: Annotation,
  transform: {
    position: { x: number; y: number };
    rotation: number;
    scaleX: number;
    scaleY: number;
  },
): Partial<Annotation> {
  const base = {
    position: transform.position,
    rotation: transform.rotation,
  };

  switch (annotation.kind) {
    case 'rectangle':
      return {
        ...base,
        width: absScaled(annotation.width, transform.scaleX),
        height: absScaled(annotation.height, transform.scaleY),
      } as Partial<Annotation>;
    case 'ellipse':
      return {
        ...base,
        radiusX: absScaled(annotation.radiusX, transform.scaleX),
        radiusY: absScaled(annotation.radiusY, transform.scaleY),
      } as Partial<Annotation>;
    case 'text':
      return {
        ...base,
        width: absScaled(annotation.width, transform.scaleX),
        style: {
          ...annotation.style,
          textSize: absScaled(annotation.style.textSize, transform.scaleY),
        },
      } as Partial<Annotation>;
    case 'line':
    case 'arrow':
    case 'measurement':
      return {
        ...base,
        points: scalePoints(annotation.points, transform.scaleX, transform.scaleY),
      } as Partial<Annotation>;
    case 'polygon':
      return {
        ...base,
        points: scalePoints(annotation.points, transform.scaleX, transform.scaleY),
      } as Partial<Annotation>;
    case 'pin': {
      const scale = Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
      return {
        ...base,
        size: absScaled(annotation.size, scale),
      } as Partial<Annotation>;
    }
    case 'image':
      return {
        ...base,
        width: absScaled(annotation.width, transform.scaleX),
        height: absScaled(annotation.height, transform.scaleY),
      } as Partial<Annotation>;
    case 'legend':
    case 'titleblock':
    case 'sourcecredit':
      return {
        ...base,
        width: absScaled(annotation.width, transform.scaleX),
      } as Partial<Annotation>;
    case 'scalebar':
      return {
        ...base,
        maxWidth: absScaled(annotation.maxWidth, transform.scaleX),
      } as Partial<Annotation>;
    case 'northarrow': {
      const scale = Math.max(Math.abs(transform.scaleX), Math.abs(transform.scaleY));
      return {
        ...base,
        size: absScaled(annotation.size, scale),
      } as Partial<Annotation>;
    }
    case 'comment':
      // Comment pins are uniformly scaled like map pins — they reuse the pin size.
      return base as Partial<Annotation>;
  }
}
