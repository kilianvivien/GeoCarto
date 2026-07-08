import type { GeoProjection } from 'd3-geo';

/**
 * Fit a d3-geo projection's scale/translate so the whole globe (or a given
 * GeoJSON extent) fills the frame, then return the resulting scale/center —
 * used to seed a `ProjectionConfig` when the user first switches to a
 * projection or resizes the export frame.
 */
export function fitProjectionToFrame(
  projection: GeoProjection,
  frame: { width: number; height: number },
  extent: GeoJSON.GeoJSON | { type: 'Sphere' } = { type: 'Sphere' },
): { scale: number; center: [number, number] } {
  projection.fitSize([frame.width, frame.height], extent);
  const [x, y] = projection.translate();
  return { scale: projection.scale(), center: [x, y] };
}
