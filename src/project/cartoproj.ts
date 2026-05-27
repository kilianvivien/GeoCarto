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
  | 'pin';

export type AnnotationAnchorMode = 'map' | 'canvas';
export type ProjectMode = 'mapSetup' | 'editing';
export type BuiltInBasemapPreset = 'editorial-light' | 'editorial-dark' | 'minimal-grey' | 'print-bw';

export type BasemapConfig =
  | {
      kind: 'builtin';
      preset: BuiltInBasemapPreset;
      name: string;
      attribution: string;
    }
  | {
      kind: 'style-url';
      name: string;
      url: string;
      attribution: string;
    }
  | {
      kind: 'pmtiles-url';
      name: string;
      url: string;
      preset: BuiltInBasemapPreset;
      attribution: string;
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

export const DEFAULT_BASEMAP: BasemapConfig = {
  kind: 'builtin',
  preset: 'editorial-light',
  name: 'Editorial Light',
  attribution: 'Protomaps © OpenStreetMap',
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

export interface AnnotationStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  textColor: string;
  textSize: number;
  fontFamily: string;
  pinColor: string;
  pinIcon: PinIcon;
}

export const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  fillColor: '#007aff',
  strokeColor: '#0f172a',
  strokeWidth: 2,
  textColor: '#111827',
  textSize: 18,
  fontFamily: 'Inter',
  pinColor: '#ff3b30',
  pinIcon: 'dot',
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

export type Annotation =
  | TextAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | PolygonAnnotation
  | PinAnnotation;

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
  /** Export composition frame, in pixels. */
  exportFrame: { width: number; height: number };
  basemap: BasemapConfig;
  lockedMapView: LockedMapView | null;
  /** Ordered bottom → top. `layers[0]` draws beneath the rest. */
  layers: GeoJsonLayer[];
  /** Ordered bottom → top editable annotation objects. */
  annotations: Annotation[];
}

/** Create a blank project document. */
export function createEmptyProject(name = 'Untitled'): CartoProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    mode: 'mapSetup',
    meta: { name, createdAt: now, updatedAt: now },
    viewport: { ...DEFAULT_VIEWPORT, center: [...DEFAULT_VIEWPORT.center] },
    exportFrame: { width: 1600, height: 1200 },
    basemap: { ...DEFAULT_BASEMAP },
    lockedMapView: null,
    layers: [],
    annotations: [],
  };
}
