import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import { isTauri } from '@/app/platform';
import { REMOTE_PMTILES_URL } from './basemapStyle';

let registered = false;

/**
 * A pmtiles {@link Source} that fetches byte ranges through Tauri's HTTP plugin
 * (a native reqwest call) instead of the browser `fetch`. The default Protomaps
 * demo archive sends no `Access-Control-Allow-Origin`, so a direct fetch from
 * the desktop `tauri://localhost` origin is blocked by CORS — the same reason
 * the web build proxies it same-origin. Routing through the Rust side sidesteps
 * CORS entirely. Glyphs/sprites come from `protomaps.github.io`, which serves
 * `Access-Control-Allow-Origin: *`, so those still use the normal fetch path.
 */
class TauriHttpSource implements Source {
  constructor(private readonly url: string) {}

  getKey(): string {
    return this.url;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const headers = new Headers();
    headers.set('Range', `bytes=${offset}-${offset + length - 1}`);

    const response = await tauriFetch(this.url, { method: 'GET', headers, signal });
    if (response.status >= 300) {
      throw new Error(`PMTiles request failed: ${response.status}`);
    }

    const responseEtag = response.headers.get('etag') ?? undefined;
    return {
      data: await response.arrayBuffer(),
      etag: responseEtag && !responseEtag.startsWith('W/') ? responseEtag : undefined,
      cacheControl: response.headers.get('cache-control') ?? undefined,
      expires: response.headers.get('expires') ?? undefined,
    };
  }
}

/**
 * Register the `pmtiles://` protocol on MapLibre once per page.
 * Idempotent — safe under React StrictMode double-invoke and Vite HMR.
 *
 * On the Tauri desktop shell the default remote archive is pre-registered with
 * a native-fetch source so it resolves without browser CORS. Any other PMTiles
 * URL (custom user archives) falls through to pmtiles' own `FetchSource`, which
 * works whenever that host serves CORS — matching the web build's behavior.
 */
export function registerPmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  if (isTauri()) {
    protocol.add(new PMTiles(new TauriHttpSource(REMOTE_PMTILES_URL)));
  }
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}
