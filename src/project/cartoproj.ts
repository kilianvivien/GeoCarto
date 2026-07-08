import type { FeatureCollection } from 'geojson';
import type { Viewport } from '@/state/viewportStore';
import { DEFAULT_VIEWPORT } from '@/state/viewportStore';
import { translate } from '@/i18n/useLocale';
import { defaultBasemapPreset } from '@/state/preferencesStore';

/** Geometry families a GeoJSON layer can hold. */
export type GeometryKind = 'point' | 'line' | 'polygon' | 'mixed';

export interface FeatureFillStyle {
  fillColor: string;
  fillPattern: FillPattern;
  hatchColor: string;
  hatchSpacing: number;
}

export type ClassificationMethod = 'quantile' | 'equal' | 'jenks' | 'manual';

/** Color-by-value styling for polygon/line layers (choropleth map). */
export interface ChoroplethStyle {
  kind: 'choropleth';
  attribute: string;
  method: ClassificationMethod;
  /** Requested class count (3–9); the effective count may be lower when the
   *  attribute has fewer distinct values. */
  classCount: number;
  /** Materialized interior breaks (length = classCount - 1), recomputed by the
   *  UI whenever attribute/method/classCount change (or on demand after a data
   *  edit) — never at render time, so a saved project renders identically even
   *  if classification code changes later. */
  breaks: number[];
  paletteId: string;
  reverse: boolean;
  missingColor: string;
}

/** Size-by-value styling for point layers (proportional symbols). */
export interface ProportionalStyle {
  kind: 'proportional';
  attribute: string;
  minRadius: number;
  maxRadius: number;
  scale: 'sqrt' | 'linear';
  color: string;
}

export type DataStyle = ChoroplethStyle | ProportionalStyle;

/** Render style for an imported GeoJSON layer (Milestone 4 makes this editable). */
export interface GeoJsonStyle {
  fillColor: string;
  fillOpacity: number;
  /** Per-feature fill overrides keyed by the feature's stable OSM `@id` property. */
  featureFillColors: Record<string, string>;
  /** Per-feature full fill styles keyed by the feature's stable OSM `@id` property. */
  featureFillStyles: Record<string, FeatureFillStyle>;
  /** Hatch fill pattern for polygon layers; `none` paints a solid fill. */
  fillPattern: FillPattern;
  hatchColor: string;
  hatchSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  pointColor: string;
  pointRadius: number;
  /** Whether point features in this layer should be rendered as circles. */
  showPoints: boolean;
  /** Data-driven styling (choropleth / proportional symbols). Absent = single style (default). */
  dataStyle?: DataStyle;
}

export const DEFAULT_GEOJSON_STYLE: GeoJsonStyle = {
  fillColor: '#007aff',
  fillOpacity: 0.25,
  featureFillColors: {},
  featureFillStyles: {},
  fillPattern: 'none',
  hatchColor: '#0f172a',
  hatchSpacing: 10,
  strokeColor: '#007aff',
  strokeWidth: 1.5,
  pointColor: '#007aff',
  pointRadius: 5,
  showPoints: true,
};

/**
 * How a layer's geometry is drawn. `vector` is the default MapLibre fill/line/
 * circle render; `heatmap` renders the same source as a deck.gl density layer
 * (Milestone 12) interleaved with the basemap.
 */
export type LayerRenderStrategy = 'vector' | 'heatmap';

/** An imported GeoJSON dataset rendered as a map layer. */
export interface GeoJsonLayer {
  id: string;
  kind: 'geojson';
  name: string;
  visible: boolean;
  locked: boolean;
  geometry: GeometryKind;
  featureCount: number;
  data: FeatureCollection;
  style: GeoJsonStyle;
  /** Render strategy; defaults to `vector` for Phase 1 documents (see serialize.ts). */
  renderStrategy?: LayerRenderStrategy;
}

export type AnnotationKind =
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'pin'
  | 'measurement'
  | 'image'
  | 'legend'
  | 'comment'
  | 'titleblock'
  | 'sourcecredit'
  | 'scalebar'
  | 'northarrow';

export type AnnotationAnchorMode = 'map' | 'canvas';
export type ProjectMode = 'mapSetup' | 'editing';
export type BuiltInBasemapPreset = 'editorial-light' | 'editorial-dark' | 'minimal-grey' | 'print-bw';

/**
 * Editorial sub-layer groups for a Protomaps-based basemap. Each maps to one
 * or more Protomaps `source-layer` names (see basemapStyle.ts).
 */
export type BasemapSublayerKey =
  | 'earth'
  | 'roads'
  /** Legacy aggregate; newer UI exposes `places` and `pois` separately. */
  | 'labels'
  | 'places'
  | 'pois'
  | 'water'
  | 'landcover'
  | 'landuse'
  | 'buildings'
  | 'boundaries';

export type BasemapSublayers = Record<BasemapSublayerKey, boolean>;

export const DEFAULT_BASEMAP_SUBLAYERS: BasemapSublayers = {
  earth: true,
  roads: true,
  labels: true,
  places: true,
  pois: true,
  water: true,
  landcover: true,
  landuse: true,
  buildings: true,
  boundaries: true,
};

export type BasemapConfig =
  | {
      kind: 'builtin';
      preset: BuiltInBasemapPreset;
      name: string;
      attribution: string;
      sublayers: BasemapSublayers;
    }
  | {
      kind: 'style-url';
      name: string;
      url: string;
      attribution: string;
    }
  | {
      kind: 'style-json';
      name: string;
      /** Serialized MapLibre StyleSpecification. Stored as a string so the schema stays JSON-friendly. */
      styleJson: string;
      attribution: string;
    }
  | {
      kind: 'pmtiles-url';
      name: string;
      url: string;
      preset: BuiltInBasemapPreset;
      attribution: string;
      sublayers: BasemapSublayers;
    }
  | {
      kind: 'pmtiles-file';
      name: string;
      path: string;
      preset: BuiltInBasemapPreset;
      attribution: string;
      sublayers: BasemapSublayers;
    }
  | {
      kind: 'static';
      name: string;
      mediaType: 'image' | 'pdf';
      mimeType: string;
      dataUrl: string;
      attribution: string;
    }
  | {
      kind: 'empty';
      name: string;
      attribution: string;
    };

export interface LockedMapView {
  viewport: Viewport;
  exportFrame: { width: number; height: number };
  basemap: BasemapConfig;
  lockedAt: string;
}

/** Strip page-settings extras off an ExportFrame for the LockedMapView snapshot. */
export function snapshotFrameSize(frame: { width: number; height: number }): { width: number; height: number } {
  return { width: frame.width, height: frame.height };
}

export const DEFAULT_BASEMAP: BasemapConfig = {
  kind: 'builtin',
  preset: 'editorial-light',
  name: 'Editorial Light',
  attribution: 'Protomaps © OpenStreetMap',
  sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
};

const BASEMAP_PRESET_NAME: Record<BuiltInBasemapPreset, string> = {
  'editorial-light': 'Editorial Light',
  'editorial-dark': 'Editorial Dark',
  'minimal-grey': 'Minimal Grey',
  'print-bw': 'Print B&W',
};

/** Build a built-in basemap config for a preset. Used for the per-install default. */
export function builtinBasemap(preset: BuiltInBasemapPreset): BasemapConfig {
  return {
    kind: 'builtin',
    preset,
    name: BASEMAP_PRESET_NAME[preset],
    attribution: 'Protomaps © OpenStreetMap',
    sublayers: { ...DEFAULT_BASEMAP_SUBLAYERS },
  };
}

export type PinIcon =
  | 'dot'
  | 'ring'
  | 'flag'
  | 'star'
  | 'triangle'
  | 'square'
  | 'diamond'
  | 'cross'
  | 'target';

export type FillPattern = 'none' | 'diagonal' | 'crosshatch' | 'horizontal' | 'vertical' | 'dots';
export type StrokePattern = 'solid' | 'dotted' | 'dashed';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';
export type BrushPreset = 'round' | 'marker' | 'pencil' | 'highlighter';

export interface AnnotationStyle {
  fillColor: string;
  fillPattern: FillPattern;
  hatchColor: string;
  hatchSpacing: number;
  strokeColor: string;
  strokeWidth: number;
  strokePattern: StrokePattern;
  textColor: string;
  textSize: number;
  fontFamily: string;
  pinColor: string;
  pinIcon: PinIcon;
  /** Outer halo painted beneath the shape; 0 width disables. */
  haloColor: string;
  haloWidth: number;
  /** Drop shadow projected onto the canvas; 0 blur + 0 offset disables. */
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  /** Composite operation applied to the annotation group. */
  blendMode: BlendMode;
  /** Freehand brush rendering style. Ignored by regular line and arrow tools. */
  brushPreset: BrushPreset;
}

export type LegendFillStyle = Pick<
  AnnotationStyle,
  'fillColor' | 'fillPattern' | 'hatchColor' | 'hatchSpacing'
>;

export type LegendFillSymbol = { kind: 'fill' } & LegendFillStyle;
export type LegendLineSymbol = {
  kind: 'line' | 'arrow' | 'measurement';
  strokeColor: string;
  strokeWidth: number;
  strokePattern: StrokePattern;
  brushPreset?: BrushPreset;
};
export type LegendPinSymbol = {
  kind: 'pin';
  pinColor: string;
  pinIcon: PinIcon;
};
export type LegendSymbol = LegendFillSymbol | LegendLineSymbol | LegendPinSymbol;

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  fillColor: '#007aff',
  fillPattern: 'none',
  hatchColor: '#0f172a',
  hatchSpacing: 10,
  strokeColor: '#0f172a',
  strokeWidth: 2,
  strokePattern: 'solid',
  textColor: '#111827',
  textSize: 18,
  fontFamily: 'Inter',
  pinColor: '#ff3b30',
  pinIcon: 'dot',
  haloColor: '#ffffff',
  haloWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  blendMode: 'normal',
  brushPreset: 'round',
};

export interface AnnotationBase {
  id: string;
  kind: AnnotationKind;
  name: string;
  visible: boolean;
  locked: boolean;
  anchorMode: AnnotationAnchorMode;
  /** Canvas-space origin for canvas-pinned annotations. */
  position: { x: number; y: number };
  /** Geographic origin for map-pinned annotations. */
  geoAnchor: [number, number] | null;
  rotation: number;
  opacity: number;
  style: AnnotationStyle;
  groupId?: string | null;
}

export type TextAnnotation = AnnotationBase & {
  kind: 'text';
  text: string;
  width: number;
};

export type RectAnnotation = AnnotationBase & {
  kind: 'rectangle';
  width: number;
  height: number;
  cornerRadius: number;
};

export type EllipseAnnotation = AnnotationBase & {
  kind: 'ellipse';
  radiusX: number;
  radiusY: number;
};

export type LineAnnotation = AnnotationBase & {
  kind: 'line' | 'arrow';
  points: number[];
  lineRole?: 'line' | 'brush';
};

export type PolygonAnnotation = AnnotationBase & {
  kind: 'polygon';
  points: number[];
  closed: true;
};

export type PinAnnotation = AnnotationBase & {
  kind: 'pin';
  label: string;
  size: number;
};

export type MeasurementUnitSystem = 'metric' | 'imperial';

export type MeasurementAnnotation = AnnotationBase & {
  kind: 'measurement';
  points: number[];
  geoPoints: [number, number][];
  unitSystem: MeasurementUnitSystem;
};

export type ImageAnnotation = AnnotationBase & {
  kind: 'image';
  /** Base64 data URL — embedded so the project file round-trips standalone. */
  src: string;
  width: number;
  height: number;
  /** Natural pixel dimensions, preserved so resizing can restore aspect ratio. */
  naturalWidth: number;
  naturalHeight: number;
};

export interface LegendEntry {
  label: string;
  swatchColor: string;
  /** Typed symbol used by modern legend renderers. Missing means legacy fill swatch. */
  symbol?: LegendSymbol;
  /** Legacy fill swatch style retained so old project files round-trip cleanly. */
  fillStyle?: LegendFillStyle;
  visible: boolean;
}

export type LegendAnnotation = AnnotationBase & {
  kind: 'legend';
  title: string;
  entries: LegendEntry[];
  width: number;
  /** Source layer this legend's entries were generated from, if any — lets the
   *  "Refresh from layer" action regenerate `entries` after the layer's data
   *  style changes. Entries stay materialized (not recomputed at render time)
   *  so the legend still renders correctly if the source layer is later removed. */
  dataStyleLink?: { layerId: string };
};

export type CommentAnnotation = AnnotationBase & {
  kind: 'comment';
  text: string;
  author: string | null;
  createdAt: string;
};

/** Title block — headline + optional subtitle, a first-class map-furniture annotation. */
export type TitleBlockAnnotation = AnnotationBase & {
  kind: 'titleblock';
  title: string;
  subtitle: string;
  width: number;
};

/** Source / credit line, typically anchored to a frame corner. */
export type SourceCreditAnnotation = AnnotationBase & {
  kind: 'sourcecredit';
  text: string;
  width: number;
};

/** Scale bar that tracks the live map scale; length snaps to a round distance. */
export type ScaleBarAnnotation = AnnotationBase & {
  kind: 'scalebar';
  unitSystem: MeasurementUnitSystem;
  /** Maximum on-screen bar width in px; the rendered bar snaps to a round value below this. */
  maxWidth: number;
};

/** North arrow that follows the map bearing. */
export type NorthArrowAnnotation = AnnotationBase & {
  kind: 'northarrow';
  size: number;
};

export type Annotation =
  | TextAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | PolygonAnnotation
  | PinAnnotation
  | MeasurementAnnotation
  | ImageAnnotation
  | LegendAnnotation
  | CommentAnnotation
  | TitleBlockAnnotation
  | SourceCreditAnnotation
  | ScaleBarAnnotation
  | NorthArrowAnnotation;

export interface AnnotationGroup {
  id: string;
  name: string;
  locked: boolean;
  annotationIds: string[];
}

export type PagePresetKey =
  | 'a4-landscape'
  | 'a4-portrait'
  | 'a3-landscape'
  | 'a3-portrait'
  | 'letter-landscape'
  | 'letter-portrait'
  | 'tabloid-landscape'
  | '16-9'
  | '4-3'
  | 'square'
  | 'custom';

export type PageBackground = 'white' | 'transparent' | string;

/**
 * Export composition frame. Width/height are the base canvas pixels (at 1× DPI);
 * the rendered output is `width × dpiScale` pixels wide. `preset` is purely a hint
 * for the UI dropdown — the canonical size is always `width × height`.
 */
export interface ExportFrame {
  width: number;
  height: number;
  preset?: PagePresetKey;
  /** Symmetric margin in pixels (at 1× DPI) reserved inside the frame for export composition. */
  margin?: number;
  /** Page background — `"white"` (default), `"transparent"`, or a hex color. */
  background?: PageBackground;
  /** Output multiplier applied to width/height during raster export. */
  dpiScale?: number;
}

/** The canonical project document — source of truth for all renderers (PRD §3). */
export interface CartoProject {
  version: 1;
  mode: ProjectMode;
  meta: {
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  viewport: Viewport;
  exportFrame: ExportFrame;
  basemap: BasemapConfig;
  lockedMapView: LockedMapView | null;
  /** Ordered bottom → top. `layers[0]` draws beneath the rest. */
  layers: GeoJsonLayer[];
  /** Ordered bottom → top editable annotation objects. */
  annotations: Annotation[];
  annotationGroups: AnnotationGroup[];
}

/** Create a blank project document. */
export function createEmptyProject(name = translate('common.untitled')): CartoProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    mode: 'mapSetup',
    meta: { name, createdAt: now, updatedAt: now },
    viewport: { ...DEFAULT_VIEWPORT, center: [...DEFAULT_VIEWPORT.center] },
    exportFrame: { width: 1600, height: 1200, preset: '4-3', margin: 0, background: 'white', dpiScale: 1 },
    basemap: builtinBasemap(defaultBasemapPreset()),
    lockedMapView: null,
    layers: [],
    annotations: [],
    annotationGroups: [],
  };
}
