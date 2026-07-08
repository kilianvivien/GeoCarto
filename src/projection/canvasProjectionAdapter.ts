import type { GeoProjection } from 'd3-geo';
import type { CanvasProjection } from '@/canvas/canvasProjection';

/**
 * Wraps a d3-geo projection as a `CanvasProjection` so the rest of the app
 * (annotation anchoring, exports) can treat it the same as the Mercator path.
 * `project` returns null for antipodal/clipped points — d3-geo's own signal
 * for "not visible under this projection."
 *
 * `unproject`'s accuracy depends on the projection: Equal Earth, Natural
 * Earth I, Robinson, and Winkel Tripel all provide exact inverses via d3-geo/
 * d3-geo-projection. Bonne's inverse is a numeric approximation (small error
 * near the poles) — acceptable for annotation click-to-place, not for survey-
 * grade accuracy.
 */
export function createD3CanvasProjection(projection: GeoProjection): CanvasProjection {
  return {
    kind: 'projected',
    project(lngLat) {
      const point = projection(lngLat);
      if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return null;
      return { x: point[0], y: point[1] };
    },
    unproject(point) {
      const lngLat = projection.invert?.([point.x, point.y]);
      if (!lngLat || !Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) return null;
      return [lngLat[0], lngLat[1]];
    },
  };
}
