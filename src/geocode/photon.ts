import { fetchJson } from '@/app/platform';
import type { GeocodeProvider, GeocodeResult, GeocodeSearchOptions } from './provider';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

interface PhotonProperties {
  osm_id?: number | string;
  osm_type?: string;
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  extent?: [number, number, number, number];
}

interface PhotonFeature {
  type: 'Feature';
  properties: PhotonProperties;
  geometry: { type: 'Point'; coordinates: [number, number] };
}

interface PhotonResponse {
  type: 'FeatureCollection';
  features: PhotonFeature[];
}

/** Coarse place kind derived from Photon's `osm_key`/`osm_value` tags. */
function kindOf(props: PhotonProperties): string {
  if (props.osm_key === 'place') {
    if (props.osm_value === 'country') return 'country';
    if (props.osm_value === 'state' || props.osm_value === 'region') return 'region';
    return 'city';
  }
  if (props.osm_key === 'highway') return 'street';
  if (props.osm_key === 'boundary') return 'boundary';
  return 'poi';
}

function contextOf(props: PhotonProperties): string | undefined {
  const parts = [props.state, props.country].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length ? parts.join(', ') : undefined;
}

function labelOf(props: PhotonProperties): string {
  return props.name || props.street || props.city || props.country || 'Unknown place';
}

function toResult(feature: PhotonFeature, index: number): GeocodeResult {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const id = props.osm_type && props.osm_id !== undefined ? `${props.osm_type}/${props.osm_id}` : `photon-${index}`;
  return {
    id,
    label: labelOf(props),
    kind: kindOf(props),
    context: contextOf(props),
    center: [lng, lat],
    bbox: props.extent
      ? [
          Math.min(props.extent[0], props.extent[2]),
          Math.min(props.extent[1], props.extent[3]),
          Math.max(props.extent[0], props.extent[2]),
          Math.max(props.extent[1], props.extent[3]),
        ]
      : undefined,
  };
}

/** Photon (komoot) geocoder — free, no API key, GeoJSON results. */
export const photonProvider: GeocodeProvider = {
  async search(query: string, opts: GeocodeSearchOptions): Promise<GeocodeResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const url = new URL(PHOTON_ENDPOINT);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('lang', opts.lang === 'fr' ? 'fr' : 'en');
    url.searchParams.set('limit', String(opts.limit));
    const response = await fetchJson<PhotonResponse>(url.toString(), { signal: opts.signal });
    return response.features.map(toResult);
  },
};
