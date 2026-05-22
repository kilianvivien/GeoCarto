import type {
  Annotation,
  AnnotationAnchorMode,
  AnnotationKind,
  AnnotationStyle,
} from '@/project/cartoproj';

interface CreateAnnotationInput {
  kind: AnnotationKind;
  anchorMode: AnnotationAnchorMode;
  position: { x: number; y: number };
  geoAnchor: [number, number] | null;
  style: AnnotationStyle;
}

const TITLE: Record<AnnotationKind, string> = {
  text: 'Text',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  arrow: 'Arrow',
  polygon: 'Polygon',
  pin: 'Pin',
};

function base({ kind, anchorMode, position, geoAnchor, style }: CreateAnnotationInput) {
  return {
    id: crypto.randomUUID(),
    kind,
    name: TITLE[kind],
    visible: true,
    locked: false,
    anchorMode,
    position,
    geoAnchor,
    rotation: 0,
    opacity: 1,
    style: { ...style },
  };
}

export function createAnnotation(input: CreateAnnotationInput): Annotation {
  const seed = base(input);
  switch (input.kind) {
    case 'text':
      return { ...seed, kind: 'text', text: 'Label', width: 180 };
    case 'rectangle':
      return { ...seed, kind: 'rectangle', width: 160, height: 96, cornerRadius: 10 };
    case 'ellipse':
      return { ...seed, kind: 'ellipse', radiusX: 76, radiusY: 48 };
    case 'line':
      return { ...seed, kind: 'line', points: [0, 0, 140, 0] };
    case 'arrow':
      return { ...seed, kind: 'arrow', points: [0, 0, 150, 0] };
    case 'polygon':
      return { ...seed, kind: 'polygon', points: [0, -58, 55, 40, -55, 40], closed: true };
    case 'pin':
      return { ...seed, kind: 'pin', label: 'Place', size: 28 };
  }
}
