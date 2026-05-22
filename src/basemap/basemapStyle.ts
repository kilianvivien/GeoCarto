import type { StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';

export type BasemapTheme = 'light' | 'dark';

/** Remote Protomaps demo PMTiles archive (v4 schema, planet-wide). */
const PMTILES_URL = 'https://demo-bucket.protomaps.com/v4.pmtiles';
const SOURCE = 'protomaps';
const ASSETS = 'https://protomaps.github.io/basemaps-assets';

/**
 * Build a MapLibre style for the editorial basemap from a Protomaps flavor.
 * Phase 1 uses the hosted demo archive; a bundled local sample comes later.
 */
export function buildBasemapStyle(theme: BasemapTheme): StyleSpecification {
  return {
    version: 8,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${theme}`,
    sources: {
      [SOURCE]: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers(SOURCE, namedFlavor(theme), { lang: 'en' }),
  };
}
