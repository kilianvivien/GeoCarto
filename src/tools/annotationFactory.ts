import type {
  Annotation,
  AnnotationAnchorMode,
  AnnotationKind,
  AnnotationStyle,
} from '@/project/cartoproj';
import { translate } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';
import { defaultUnitSystem } from '@/state/preferencesStore';

interface CreateAnnotationInput {
  kind: AnnotationKind;
  anchorMode: AnnotationAnchorMode;
  position: { x: number; y: number };
  geoAnchor: [number, number] | null;
  style: AnnotationStyle;
}

const TITLE: Record<AnnotationKind, TranslationKey> = {
  text: 'tool.text',
  rectangle: 'tool.rectangle',
  ellipse: 'tool.ellipse',
  line: 'annotation.line',
  arrow: 'annotation.arrow',
  polygon: 'annotation.polygon',
  pin: 'tool.pin',
  measurement: 'annotation.measurement',
  image: 'annotation.image',
  legend: 'annotation.legend',
  comment: 'annotation.comment',
  titleblock: 'annotation.titleBlock',
  sourcecredit: 'annotation.sourceCredit',
  scalebar: 'annotation.scaleBar',
  northarrow: 'annotation.northArrow',
};

function base({ kind, anchorMode, position, geoAnchor, style }: CreateAnnotationInput) {
  return {
    id: crypto.randomUUID(),
    kind,
    name: translate(TITLE[kind]),
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
      return { ...seed, kind: 'text', text: translate('sample.label'), width: 180 };
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
      return { ...seed, kind: 'pin', label: translate('sample.place'), size: 28 };
    case 'measurement':
      return {
        ...seed,
        kind: 'measurement',
        points: [0, 0, 120, 0],
        geoPoints: input.geoAnchor ? [input.geoAnchor] : [],
        unitSystem: defaultUnitSystem(),
      };
    case 'image':
      // Image annotations are populated after the user picks a file; defaults
      // give a visible placeholder if rendered before src is assigned.
      return {
        ...seed,
        kind: 'image',
        src: '',
        width: 240,
        height: 160,
        naturalWidth: 240,
        naturalHeight: 160,
      };
    case 'legend':
      return {
        ...seed,
        kind: 'legend',
        title: translate('sample.legendTitle'),
        entries: [
          {
            label: translate('sample.legendEntry'),
            swatchColor: '#007aff',
            fillStyle: { fillColor: '#007aff', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
            visible: true,
          },
          {
            label: translate('sample.legendAnotherEntry'),
            swatchColor: '#ff9500',
            fillStyle: { fillColor: '#ff9500', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
            visible: true,
          },
        ],
        width: 200,
      };
    case 'comment':
      return {
        ...seed,
        kind: 'comment',
        text: '',
        author: null,
        createdAt: new Date().toISOString(),
      };
    case 'titleblock':
      return {
        ...seed,
        kind: 'titleblock',
        title: translate('sample.mapTitle'),
        subtitle: translate('sample.mapSubtitle'),
        width: 320,
      };
    case 'sourcecredit':
      return { ...seed, kind: 'sourcecredit', text: translate('sample.sourceCredit'), width: 280 };
    case 'scalebar':
      return { ...seed, kind: 'scalebar', unitSystem: defaultUnitSystem(), maxWidth: 140 };
    case 'northarrow':
      return { ...seed, kind: 'northarrow', size: 48 };
  }
}
