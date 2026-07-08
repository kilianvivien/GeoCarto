import { geoEqualEarth, geoNaturalEarth1, type GeoProjection } from 'd3-geo';
import { geoBonne, geoRobinson, geoWinkel3 } from 'd3-geo-projection';
import type { ProjectionConfig } from '@/project/cartoproj';

/** Construct a d3-geo projection from a materialized `ProjectionConfig`. */
export function buildD3Projection(config: ProjectionConfig): GeoProjection {
  const projection = createBaseProjection(config);
  projection.rotate([config.rotateLambda, 0]);
  projection.scale(config.scale);
  projection.translate(config.center);
  return projection;
}

function createBaseProjection(config: ProjectionConfig): GeoProjection {
  switch (config.id) {
    case 'equal-earth':
      return geoEqualEarth();
    case 'natural-earth-1':
      return geoNaturalEarth1();
    case 'robinson':
      return geoRobinson();
    case 'winkel3':
      return geoWinkel3();
    case 'bonne': {
      const projection = geoBonne();
      projection.parallel(config.parallel ?? 45);
      return projection;
    }
  }
}
