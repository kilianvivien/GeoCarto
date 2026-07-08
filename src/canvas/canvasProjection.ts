import type maplibregl from 'maplibre-gl';

/**
 * Bridges lngLat↔screen conversion for both render engines. The Mercator
 * engine wraps the live MapLibre camera (pass-through, never clips); the
 * projected engine (Feature 3) wraps a d3-geo projection, which can return
 * `null` for antipodal/clipped points.
 */
export interface CanvasProjection {
  readonly kind: 'mercator' | 'projected';
  project(lngLat: [number, number]): { x: number; y: number } | null;
  unproject(point: { x: number; y: number }): [number, number] | null;
}

/** Pure pass-through wrapper — makes the coordinate-bridge refactor a no-op on the Mercator path. */
export function createMercatorProjection(map: maplibregl.Map): CanvasProjection {
  return {
    kind: 'mercator',
    project(lngLat) {
      const point = map.project(lngLat);
      return { x: point.x, y: point.y };
    },
    unproject(point) {
      const lngLat = map.unproject([point.x, point.y]);
      return [lngLat.lng, lngLat.lat];
    },
  };
}
