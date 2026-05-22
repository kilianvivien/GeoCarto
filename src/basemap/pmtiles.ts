import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

let registered = false;

/**
 * Register the `pmtiles://` protocol on MapLibre once per page.
 * Idempotent — safe under React StrictMode double-invoke and Vite HMR.
 */
export function registerPmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}
