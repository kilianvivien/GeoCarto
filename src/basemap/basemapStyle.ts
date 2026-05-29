import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor } from '@protomaps/basemaps';
import type {
  BasemapConfig,
  BasemapSublayerKey,
  BasemapSublayers,
  BuiltInBasemapPreset,
} from '@/project/cartoproj';
import { DEFAULT_BASEMAP_SUBLAYERS } from '@/project/cartoproj';
import { isTauri } from '@/app/platform';

/** Same-origin PMTiles path; Vite dev and Vercel both proxy this to the demo archive. */
const DEFAULT_PMTILES_PATH = '/__geocarto_basemap/v4.pmtiles';
/**
 * The demo archive the same-origin path proxies to. The desktop shell has no
 * proxy (assets load from `tauri://localhost`), so it fetches the CDN directly.
 */
export const REMOTE_PMTILES_URL = 'https://demo-bucket.protomaps.com/v4.pmtiles';
const DEFAULT_PMTILES_URL =
  import.meta.env.VITE_GEOCARTO_PMTILES_URL ||
  (isTauri() ? REMOTE_PMTILES_URL : DEFAULT_PMTILES_PATH);
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

/**
 * Editorial sub-layer keys → Protomaps `source-layer` names. `labels` covers
 * both places and points-of-interest; `landuse` covers landuse + landcover.
 */
const SUBLAYER_TO_SOURCE_LAYERS: Record<BasemapSublayerKey, string[]> = {
  roads: ['roads'],
  labels: ['places', 'pois'],
  water: ['water'],
  landuse: ['landuse', 'landcover'],
  buildings: ['buildings'],
  boundaries: ['boundaries'],
};

function asPmtilesUrl(url: string) {
  return url.startsWith('pmtiles://') ? url : `pmtiles://${url}`;
}

/**
 * Drop layers whose Protomaps `source-layer` belongs to a sub-layer that the
 * project has hidden. Unknown source-layers (e.g. background, earth) are kept.
 */
export function applySublayerVisibility(
  styleLayers: LayerSpecification[],
  sublayers: BasemapSublayers,
): LayerSpecification[] {
  const hidden = new Set<string>();
  for (const key of Object.keys(sublayers) as BasemapSublayerKey[]) {
    if (sublayers[key]) continue;
    for (const sourceLayer of SUBLAYER_TO_SOURCE_LAYERS[key]) hidden.add(sourceLayer);
  }
  if (hidden.size === 0) return styleLayers;
  return styleLayers.filter((layer) => {
    const sourceLayer = (layer as { 'source-layer'?: string })['source-layer'];
    return !sourceLayer || !hidden.has(sourceLayer);
  });
}

/**
 * Build a MapLibre style for the editorial basemap from a Protomaps flavor.
 * Phase 1 uses the hosted demo archive; a bundled local sample comes later.
 */
export function buildBasemapStyle(config: BasemapConfig): StyleSpecification | string {
  if (config.kind === 'style-url') return config.url;
  if (config.kind === 'style-json') {
    // Trusted to be JSON-parseable — the StylePanel validates before assignment.
    return JSON.parse(config.styleJson) as StyleSpecification;
  }

  const preset =
    config.kind === 'pmtiles-url'
      ? config.preset
      : config.kind === 'builtin'
        ? config.preset
        : 'editorial-light';
  const sourceUrl = config.kind === 'pmtiles-url' ? config.url : DEFAULT_PMTILES_URL;
  const spriteTheme = PRESET_TO_SPRITE[preset];
  const sublayers =
    config.kind === 'builtin' || config.kind === 'pmtiles-url'
      ? config.sublayers
      : DEFAULT_BASEMAP_SUBLAYERS;
  const flavorLayers = layers(SOURCE, namedFlavor(PRESET_TO_FLAVOR[preset]), { lang: 'en' });

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
    layers: applySublayerVisibility(flavorLayers as LayerSpecification[], sublayers),
  };
}
