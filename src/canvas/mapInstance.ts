import { create } from 'zustand';
import type maplibregl from 'maplibre-gl';
import type { CanvasProjection } from './canvasProjection';

interface MapInstanceState {
  /** The live MapLibre map, or null before it mounts / on projected documents. */
  map: maplibregl.Map | null;
  /**
   * The active lngLat↔screen bridge for whichever engine is mounted. MapView
   * publishes a Mercator wrapper around `map`; ProjectedMapView publishes a
   * d3-geo wrapper and leaves `map` null. Consumers that only need coordinate
   * conversion (annotation anchoring, exports) should read this instead of
   * `map` so they work on both engines.
   */
  projection: CanvasProjection | null;
  /** Live render-surface size in CSS px, published by whichever engine is mounted. */
  containerSize: { width: number; height: number } | null;
  setMap: (map: maplibregl.Map | null) => void;
  setProjection: (projection: CanvasProjection | null) => void;
  setContainerSize: (size: { width: number; height: number } | null) => void;
}

/**
 * Holds the live map/projection so non-owning components (layer sync, export,
 * annotation stage) can reach them without prop-drilling. MapView/ProjectedMapView
 * are the sole writers, one active at a time depending on `project.engine`.
 */
export const useMapInstance = create<MapInstanceState>((set) => ({
  map: null,
  projection: null,
  containerSize: null,
  setMap: (map) => set({ map }),
  setProjection: (projection) => set({ projection }),
  setContainerSize: (containerSize) => set({ containerSize }),
}));
