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

/** The canonical project document — source of truth for all renderers (PRD §3). */
export interface CartoProject {
  version: 1;
  meta: {
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  viewport: Viewport;
  /** Export composition frame, in pixels. */
  exportFrame: { width: number; height: number };
  /** Ordered bottom → top. `layers[0]` draws beneath the rest. */
  layers: GeoJsonLayer[];
}

/** Create a blank project document. */
export function createEmptyProject(name = 'Untitled'): CartoProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: { name, createdAt: now, updatedAt: now },
    viewport: DEFAULT_VIEWPORT,
    exportFrame: { width: 1600, height: 1200 },
    layers: [],
  };
}
