import type { FeatureCollection } from 'geojson';
import type { Viewport } from '@/state/viewportStore';
import { DEFAULT_VIEWPORT } from '@/state/viewportStore';

/** Geometry families a GeoJSON layer can hold. */
export type GeometryKind = 'point' | 'line' | 'polygon' | 'mixed';

/** Render style for an imported GeoJSON layer (Milestone 4 makes this editable). */
export interface GeoJsonStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  pointColor: string;
  pointRadius: number;
}

export const DEFAULT_GEOJSON_STYLE: GeoJsonStyle = {
  fillColor: '#007aff',
  fillOpacity: 0.25,
  strokeColor: '#007aff',
  strokeWidth: 1.5,
  pointColor: '#007aff',
  pointRadius: 5,
};

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
  | 'comment';

export type AnnotationAnchorMode = 'map' | 'canvas';
export type ProjectMode = 'mapSetup' | 'editing';
export type BuiltInBasemapPreset = 'editorial-light' | 'editorial-dark' | 'minimal-grey' | 'print-bw';

/**
 * Editorial sub-layer groups for a Protomaps-based basemap. Each maps to one
 * or more Protomaps `source-layer` names (see basemapStyle.ts).
 */
export type BasemapSublayerKey =
  | 'roads'
  | 'labels'
  | 'water'
  | 'landuse'
  | 'buildings'
  | 'boundaries';

export type BasemapSublayers = Record<BasemapSublayerKey, boolean>;

export const DEFAULT_BASEMAP_SUBLAYERS: BasemapSublayers = {
  roads: true,
  labels: true,
  water: true,
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
      kind: 'static';
      name: string;
      mediaType: 'image' | 'pdf';
      mimeType: string;
      dataUrl: string;
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
  visible: boolean;
}

export type LegendAnnotation = AnnotationBase & {
  kind: 'legend';
  title: string;
  entries: LegendEntry[];
  width: number;
};

export type CommentAnnotation = AnnotationBase & {
  kind: 'comment';
  text: string;
  author: string | null;
  createdAt: string;
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
  | CommentAnnotation;

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
export function createEmptyProject(name = 'Untitled'): CartoProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    mode: 'mapSetup',
    meta: { name, createdAt: now, updatedAt: now },
    viewport: { ...DEFAULT_VIEWPORT, center: [...DEFAULT_VIEWPORT.center] },
    exportFrame: { width: 1600, height: 1200, preset: '4-3', margin: 0, background: 'white', dpiScale: 1 },
    basemap: { ...DEFAULT_BASEMAP },
    lockedMapView: null,
    layers: [],
    annotations: [],
    annotationGroups: [],
  };
}
