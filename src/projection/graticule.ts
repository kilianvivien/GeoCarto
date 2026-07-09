const LAT_EXTENT = 80;
const SAMPLE_STEP_DEG = 2;

/**
 * Lat/lon grid lines at a given interval, as a GeoJSON MultiLineString in
 * [lng, lat] coordinates. Hand-rolled (not `d3.geoGraticule`) so this module —
 * used by the always-mounted `AnnotationStage`/export renderers for the
 * `graticule` annotation kind — doesn't pull `d3-geo` into the main app-shell
 * chunk; only the projected-engine render path (`ProjectedMapView`, raster/SVG
 * export) needs the real d3-geo projection math and is already lazy-loaded.
 * Each line is densely sampled (every `SAMPLE_STEP_DEG`) so it still reads as a
 * smooth curve once projected through a non-linear projection.
 */
export function buildGraticule(intervalDeg: number): GeoJSON.MultiLineString {
  const step = Math.max(1, intervalDeg);
  const coordinates: [number, number][][] = [];

  for (let lon = -180; lon < 180; lon += step) {
    const line: [number, number][] = [];
    for (let lat = -LAT_EXTENT; lat <= LAT_EXTENT; lat += SAMPLE_STEP_DEG) line.push([lon, lat]);
    coordinates.push(line);
  }
  for (let lat = -LAT_EXTENT; lat <= LAT_EXTENT; lat += step) {
    const line: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += SAMPLE_STEP_DEG) line.push([lon, lat]);
    coordinates.push(line);
  }

  return { type: 'MultiLineString', coordinates };
}
