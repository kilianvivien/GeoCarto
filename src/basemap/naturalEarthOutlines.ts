import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/**
 * Bundled world-land outlines for the projected (non-Mercator) engine — Feature
 * 3's editorial projections have no tile basemap (MapLibre can't reproject
 * tiles), so this is the cartographic context shown beneath the user's own
 * layers. 110m resolution is plenty at world/continental scale and keeps the
 * lazy chunk small; loaded via `?url` + `fetch` (not a static import) so the
 * ~100-150KB payload is a network-lazy asset, never part of any JS chunk.
 */

interface LandTopology extends Topology {
  objects: { land: GeometryCollection };
}

let cached: Promise<FeatureCollection<Geometry>> | null = null;

export function loadNaturalEarthLand(): Promise<FeatureCollection<Geometry>> {
  if (!cached) {
    cached = (async () => {
      const [{ default: landUrl }, topojson] = await Promise.all([
        import('world-atlas/land-110m.json?url'),
        import('topojson-client'),
      ]);
      const topology = (await fetch(landUrl).then((res) => res.json())) as LandTopology;
      return topojson.feature(topology, topology.objects.land);
    })();
  }
  return cached;
}
