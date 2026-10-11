import type { FeatureCollection } from 'geojson';
import {
  DEFAULT_ANNOTATION_STYLE,
  builtinBasemap,
  type Annotation,
  type AnnotationKind,
  type BuiltInBasemapPreset,
  type GeoJsonLayer,
} from './cartoproj';
import { FRAME_CORNERS, useAuthoringHints, type AuthoringHints, type FrameCorner } from './authoringHints';
import { featureCollectionToLayer } from '@/import/geojson';
import { buildCategoricalStyle } from '@/style/categories';
import { computeBreaks, scanAttribute } from '@/style/classify';
import { DEFAULT_LABEL_STYLE } from '@/style/labels';
import { dataStyleLegendEntries } from '@/style/legendSwatches';
import { DEFAULT_RAMP_ID } from '@/style/ramps';
import { createAnnotation } from '@/tools/annotationFactory';
import { DEFAULT_VIEWPORT } from '@/state/viewportStore';
import { translate } from '@/i18n/useLocale';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Rough rendered height of an annotation, for corner placement before it has ever been drawn. */
function estimatedSize(annotation: Annotation): { width: number; height: number } {
  switch (annotation.kind) {
    case 'legend':
      return { width: annotation.width, height: 44 + annotation.entries.filter((entry) => entry.visible).length * 24 };
    case 'titleblock':
      return { width: annotation.width, height: annotation.subtitle ? 78 : 48 };
    case 'sourcecredit': {
      // Credits wrap: allow a line per ~6.5px-wide character run that fits the width.
      const lines = Math.max(1, Math.ceil((annotation.text.length * 6.5) / Math.max(1, annotation.width)));
      return { width: annotation.width, height: lines * 22 };
    }
    case 'text':
      return { width: annotation.width, height: annotation.style.textSize * 1.4 };
    case 'scalebar':
      return { width: annotation.maxWidth, height: 34 };
    case 'northarrow':
      return { width: annotation.size, height: annotation.size * 1.3 };
    case 'rectangle':
    case 'image':
      return { width: annotation.width, height: annotation.height };
    default:
      return { width: 160, height: 60 };
  }
}

/** Fill in everything a data style leaves to the app: breaks, categories, defaults. */
function completeDataStyle(layer: GeoJsonLayer): void {
  const dataStyle = layer.style.dataStyle as (Json & { kind?: string; attribute?: string }) | undefined;
  if (!dataStyle || typeof dataStyle.attribute !== 'string') return;
  const features = layer.data.features;
  if (dataStyle.kind === 'choropleth') {
    const method = (dataStyle.method as 'quantile' | 'equal' | 'jenks' | 'manual' | undefined) ?? 'quantile';
    const classCount = typeof dataStyle.classCount === 'number' ? dataStyle.classCount : 5;
    layer.style.dataStyle = {
      kind: 'choropleth',
      attribute: dataStyle.attribute,
      method,
      classCount,
      breaks: Array.isArray(dataStyle.breaks)
        ? (dataStyle.breaks as number[])
        : computeBreaks(scanAttribute(features, dataStyle.attribute).values, method === 'manual' ? 'quantile' : method, classCount),
      paletteId: typeof dataStyle.paletteId === 'string' ? dataStyle.paletteId : DEFAULT_RAMP_ID,
      reverse: dataStyle.reverse === true,
      missingColor: typeof dataStyle.missingColor === 'string' ? dataStyle.missingColor : '#cccccc',
    };
  } else if (dataStyle.kind === 'proportional') {
    layer.style.dataStyle = {
      kind: 'proportional',
      attribute: dataStyle.attribute,
      minRadius: typeof dataStyle.minRadius === 'number' ? dataStyle.minRadius : 4,
      maxRadius: typeof dataStyle.maxRadius === 'number' ? dataStyle.maxRadius : 24,
      scale: dataStyle.scale === 'linear' ? 'linear' : 'sqrt',
      color: typeof dataStyle.color === 'string' ? dataStyle.color : layer.style.pointColor,
    };
  } else if (dataStyle.kind === 'categorical') {
    const generated = buildCategoricalStyle(features, dataStyle.attribute);
    layer.style.dataStyle = {
      kind: 'categorical',
      attribute: dataStyle.attribute,
      categories: Array.isArray(dataStyle.categories)
        ? (dataStyle.categories as { value: string; color: string }[])
        : generated.categories,
      otherColor: typeof dataStyle.otherColor === 'string' ? dataStyle.otherColor : generated.otherColor,
    };
  }
}

function normalizeLayer(raw: unknown, index: number): unknown {
  if (!isObject(raw) || !isObject(raw.data) || !Array.isArray(raw.data.features)) return raw;
  // A layer the app saved carries all three; opening it must not rewrite it.
  const saved = typeof raw.id === 'string' && typeof raw.geometry === 'string' && typeof raw.featureCount === 'number';
  if (saved) return raw;
  const name = typeof raw.name === 'string' && raw.name ? raw.name : `${translate('layer.defaultName')} ${index + 1}`;
  const base = featureCollectionToLayer(name, raw.data as unknown as FeatureCollection);
  const layer = {
    ...base,
    ...raw,
    name,
    kind: 'geojson',
    // Derived from the data, never trusted from the file.
    geometry: base.geometry,
    featureCount: base.featureCount,
    style: { ...base.style, ...(isObject(raw.style) ? raw.style : {}) },
  } as GeoJsonLayer;
  completeDataStyle(layer);
  if (isObject(layer.style.labels)) layer.style.labels = { ...DEFAULT_LABEL_STYLE, ...layer.style.labels };
  return layer;
}

function normalizeAnnotation(raw: unknown, layers: GeoJsonLayer[], hints: AuthoringHints): unknown {
  if (!isObject(raw) || typeof raw.kind !== 'string') return raw;
  // As with layers: a complete, app-saved annotation is left exactly as it is.
  const saved = typeof raw.id === 'string' && isObject(raw.style) && isObject(raw.position) && raw.place === undefined;
  if (saved && !(raw.kind === 'legend' && !Array.isArray(raw.entries))) return raw;
  const { place, ...given } = raw;
  const geoAnchor = Array.isArray(given.geoAnchor) ? (given.geoAnchor as [number, number]) : null;
  // The editor's default style paints shapes accent-blue, which suits a drawn
  // rectangle but not a legend panel on a finished map: authored legends get a
  // neutral white card unless they say otherwise.
  const kindStyle = given.kind === 'legend' ? { fillColor: '#ffffff', strokeColor: '#c7c7cc', strokeWidth: 1 } : {};
  const defaults = createAnnotation({
    kind: given.kind as AnnotationKind,
    anchorMode: given.anchorMode === 'map' || (given.anchorMode === undefined && geoAnchor) ? 'map' : 'canvas',
    position: isObject(given.position) ? (given.position as { x: number; y: number }) : { x: 40, y: 40 },
    geoAnchor,
    style: { ...DEFAULT_ANNOTATION_STYLE, ...kindStyle, ...(isObject(given.style) ? given.style : {}) },
  });
  // The factory seeds placeholder wording for interactive use ("Label",
  // "Map title"); an authored annotation that omits a text field means "none".
  const blanks = Object.fromEntries(
    ['text', 'title', 'subtitle', 'label'].filter((key) => key in defaults).map((key) => [key, '']),
  );
  const annotation = { ...defaults, ...blanks, ...given, style: defaults.style } as Annotation;

  if (annotation.kind === 'legend' && annotation.dataStyleLink) {
    const source = layers.find((layer) => layer.id === annotation.dataStyleLink?.layerId);
    // An authored legend names its layer and leaves the entries to be generated.
    if (source && !Array.isArray(given.entries)) annotation.entries = dataStyleLegendEntries(source);
    if (source && typeof given.title !== 'string') annotation.title = source.name;
  }
  if (typeof place === 'string' && FRAME_CORNERS.includes(place as FrameCorner) && annotation.anchorMode === 'canvas') {
    hints.placements.push({ id: annotation.id, corner: place as FrameCorner, ...estimatedSize(annotation) });
  }
  return annotation;
}

/**
 * Complete a project document in place so a compact, hand- or agent-authored
 * file opens like one the app saved: missing ids, defaults, feature identity,
 * classification breaks, category colors, and legend entries are filled in.
 * Documents the app wrote already have all of this and pass through unchanged.
 *
 * Run after `checkProject` has accepted the document and before the legacy
 * migrations in `validateProject`.
 */
export function normalizeProject(value: Json): void {
  const now = new Date().toISOString();
  const hints: AuthoringHints = { placements: [] };

  const meta = isObject(value.meta) ? value.meta : {};
  value.meta = {
    ...meta,
    name: typeof meta.name === 'string' && meta.name ? meta.name : translate('common.untitled'),
    createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : now,
    updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : now,
  };

  const { bounds, ...viewport } = isObject(value.viewport) ? value.viewport : ({} as Json);
  if (Array.isArray(bounds) && bounds.length === 4) {
    const [west, south, east, north] = bounds as [number, number, number, number];
    hints.bounds = [west, south, east, north];
    // A sensible camera until the exact fit is computed against the live surface.
    viewport.center ??= [(west + east) / 2, (south + north) / 2];
    viewport.zoom ??= Math.max(0, Math.min(18, Math.log2((900 * 360) / (512 * Math.max(east - west, 0.0001)))));
  }
  value.viewport = { ...DEFAULT_VIEWPORT, center: [...DEFAULT_VIEWPORT.center], ...viewport };

  if (!isObject(value.exportFrame)) {
    value.exportFrame = { width: 1600, height: 1200, preset: '4-3', margin: 0, background: 'white', dpiScale: 1 };
  }

  if (!isObject(value.basemap)) {
    value.basemap = builtinBasemap('editorial-light');
  } else if (value.basemap.kind === 'builtin') {
    const preset = (value.basemap.preset as BuiltInBasemapPreset | undefined) ?? 'editorial-light';
    value.basemap = { ...builtinBasemap(preset), ...value.basemap, preset };
  } else {
    value.basemap = { name: translate('common.untitled'), attribution: '', ...value.basemap };
  }

  const layers = (Array.isArray(value.layers) ? value.layers : []).map(normalizeLayer);
  value.layers = layers;
  const usableLayers = layers.filter((layer): layer is GeoJsonLayer => isObject(layer) && typeof layer.id === 'string');
  value.annotations = (Array.isArray(value.annotations) ? value.annotations : []).map((annotation) =>
    normalizeAnnotation(annotation, usableLayers, hints),
  );

  // An authored document that carries content opens ready to edit, as if its map area had been locked.
  if (value.mode !== 'mapSetup' && value.mode !== 'editing') {
    value.mode = layers.length > 0 || (value.annotations as unknown[]).length > 0 ? 'editing' : 'mapSetup';
    if (value.mode === 'editing' && !isObject(value.lockedMapView)) {
      const frame = value.exportFrame as { width: number; height: number };
      value.lockedMapView = {
        viewport: value.viewport,
        exportFrame: { width: frame.width, height: frame.height },
        basemap: value.basemap,
        lockedAt: now,
      };
    }
  }

  useAuthoringHints.setState({ hints: hints.bounds || hints.placements.length > 0 ? hints : null });
}
