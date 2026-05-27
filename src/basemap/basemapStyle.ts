import type { StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';
import type { BasemapConfig, BuiltInBasemapPreset } from '@/project/cartoproj';

/** Same-origin PMTiles path; Vite dev and Vercel both proxy this to the demo archive. */
const DEFAULT_PMTILES_PATH = '/__geocarto_basemap/v4.pmtiles';
const DEFAULT_PMTILES_URL = import.meta.env.VITE_GEOCARTO_PMTILES_URL || DEFAULT_PMTILES_PATH;
const SOURCE = 'protomaps';
const ASSETS = 'https://protomaps.github.io/basemaps-assets';

const PRESET_TO_FLAVOR: Record<BuiltInBasemapPreset, string> = {
  'editorial-light': 'light',
  'editorial-dark': 'dark',
  'minimal-grey': 'grayscale',
  'print-bw': 'black',
};

const PRESET_TO_SPRITE: Record<BuiltInBasemapPreset, 'light' | 'dark'> = {
  'editorial-light': 'light',
  'editorial-dark': 'dark',
  'minimal-grey': 'light',
  'print-bw': 'light',
};

function asPmtilesUrl(url: string) {
  return url.startsWith('pmtiles://') ? url : `pmtiles://${url}`;
}

/**
 * Build a MapLibre style for the editorial basemap from a Protomaps flavor.
 * Phase 1 uses the hosted demo archive; a bundled local sample comes later.
 */
export function buildBasemapStyle(config: BasemapConfig): StyleSpecification | string {
  if (config.kind === 'style-url') return config.url;

  const preset = config.kind === 'pmtiles-url' ? config.preset : config.kind === 'builtin' ? config.preset : 'editorial-light';
  const sourceUrl = config.kind === 'pmtiles-url' ? config.url : DEFAULT_PMTILES_URL;
  const spriteTheme = PRESET_TO_SPRITE[preset];

  return {
    version: 8,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${spriteTheme}`,
    sources: {
      [SOURCE]: {
        type: 'vector',
        url: asPmtilesUrl(sourceUrl),
        attribution:
          config.attribution ||
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers(SOURCE, namedFlavor(PRESET_TO_FLAVOR[preset]), { lang: 'en' }),
  };
}
