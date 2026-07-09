/** A single geocoder match, normalized across providers. */
export interface GeocodeResult {
  id: string;
  /** Display name shown in the results list. */
  label: string;
  /** Coarse place type — city | country | street | poi | ... (provider-specific). */
  kind: string;
  /** Secondary line (country / region), shown under the label. */
  context?: string;
  /** [longitude, latitude]. */
  center: [number, number];
  /** [minLng, minLat, maxLng, maxLat], when the provider supplies one. */
  bbox?: [number, number, number, number];
}

export interface GeocodeSearchOptions {
  lang: string;
  limit: number;
  signal: AbortSignal;
}

/** Abstraction over a place-search backend so providers can be swapped later. */
export interface GeocodeProvider {
  search(query: string, opts: GeocodeSearchOptions): Promise<GeocodeResult[]>;
}
