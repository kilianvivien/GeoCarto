// No @types package is published for d3-geo-projection; declare just the
// projections GeoCarto actually uses (Robinson, Winkel Tripel III, Bonne).
declare module 'd3-geo-projection' {
  import type { GeoProjection } from 'd3-geo';

  export function geoRobinson(): GeoProjection;
  export function geoWinkel3(): GeoProjection;
  export function geoBonne(): GeoProjection & {
    parallel(): number;
    parallel(parallel: number): GeoProjection;
  };
}
