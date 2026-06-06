import maplibregl from 'maplibre-gl';
import { FetchSource, PMTiles, Protocol, type RangeResponse, type Source } from 'pmtiles';
import { createStore, del, get, set } from 'idb-keyval';
import { isTauri } from '@/app/platform';
import { useNotices } from '@/ui/notices';
import { translate } from '@/i18n/useLocale';
import { DEFAULT_PMTILES_URL } from './basemapStyle';

let registered = false;
const DEFAULT_PMTILES_RETRIES = 2;
const BASEMAP_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const BASEMAP_CACHE_MAX_BYTES = 8 * 1024 * 1024;
const BASEMAP_CACHE_MAX_RANGE_BYTES = 512 * 1024;
const BASEMAP_CACHE_MANIFEST_KEY = '__geocarto_pmtiles_manifest__';
const BASEMAP_NOTICE_THROTTLE_MS = 10_000;
const BASEMAP_FAILURE_NOTICE_DELAY_MS = 8_000;
const basemapCache = createStore('geocarto-basemap-cache-v1', 'pmtiles-ranges');
let retryNoticeAt = 0;
let cachedFallbackNoticeAt = 0;
let failureNoticeAt = 0;
let failureNoticeTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let failureNoticeCycle = 0;

type CachedRangeResponse = RangeResponse & {
  cachedAt: number;
};
type CacheManifest = Record<string, { size: number; lastUsed: number }>;

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = globalThis.setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function cacheKey(sourceKey: string, offset: number, length: number): string {
  return `${sourceKey}:${offset}:${length}`;
}

function fromCached(response: CachedRangeResponse): RangeResponse {
  return {
    data: response.data,
    etag: response.etag,
    cacheControl: response.cacheControl,
    expires: response.expires,
  };
}

function notifyBasemapIssue(
  kind: 'retry' | 'cached-fallback' | 'failure',
  message: string,
  tone: 'info' | 'error' = 'info',
): void {
  const now = Date.now();
  const lastNoticeAt =
    kind === 'retry'
      ? retryNoticeAt
      : kind === 'cached-fallback'
        ? cachedFallbackNoticeAt
        : failureNoticeAt;
  if (now - lastNoticeAt < BASEMAP_NOTICE_THROTTLE_MS) return;

  if (kind === 'retry') retryNoticeAt = now;
  else if (kind === 'cached-fallback') cachedFallbackNoticeAt = now;
  else failureNoticeAt = now;

  useNotices.getState().push(message, tone);
}

function clearPendingFailureNotice(): void {
  failureNoticeCycle += 1;
  if (!failureNoticeTimer) return;
  globalThis.clearTimeout(failureNoticeTimer);
  failureNoticeTimer = null;
}

function scheduleFailureNotice(): void {
  if (failureNoticeTimer) return;
  const cycle = failureNoticeCycle;
  failureNoticeTimer = globalThis.setTimeout(() => {
    failureNoticeTimer = null;
    if (failureNoticeCycle !== cycle) return;
    notifyBasemapIssue('failure', translate('basemap.tilesFailed'), 'error');
  }, BASEMAP_FAILURE_NOTICE_DELAY_MS);
}

async function readCacheManifest(): Promise<CacheManifest> {
  return (await get<CacheManifest>(BASEMAP_CACHE_MANIFEST_KEY, basemapCache).catch(
    () => undefined,
  )) ?? {};
}

async function touchCachedRange(key: string): Promise<void> {
  const manifest = await readCacheManifest();
  if (!manifest[key]) return;
  manifest[key] = { ...manifest[key], lastUsed: Date.now() };
  await set(BASEMAP_CACHE_MANIFEST_KEY, manifest, basemapCache).catch(() => undefined);
}

async function forgetCachedRange(key: string): Promise<void> {
  const manifest = await readCacheManifest();
  if (!manifest[key]) return;
  delete manifest[key];
  await Promise.all([
    set(BASEMAP_CACHE_MANIFEST_KEY, manifest, basemapCache).catch(() => undefined),
    del(key, basemapCache).catch(() => undefined),
  ]);
}

async function rememberCachedRange(key: string, size: number): Promise<void> {
  const manifest = await readCacheManifest();
  manifest[key] = { size, lastUsed: Date.now() };

  let total = Object.values(manifest).reduce((sum, entry) => sum + entry.size, 0);
  const evicted: string[] = [];
  for (const [entryKey, entry] of Object.entries(manifest).sort(
    (a, b) => a[1].lastUsed - b[1].lastUsed,
  )) {
    if (total <= BASEMAP_CACHE_MAX_BYTES) break;
    if (entryKey === key) continue;
    total -= entry.size;
    delete manifest[entryKey];
    evicted.push(entryKey);
  }

  await Promise.all(evicted.map((entryKey) => del(entryKey, basemapCache).catch(() => undefined)));
  await set(BASEMAP_CACHE_MANIFEST_KEY, manifest, basemapCache).catch(() => undefined);
}

/**
 * Adds a small retry window around the built-in archive. PMTiles range requests
 * are tiny but numerous, so retrying transient network/CDN hiccups makes the
 * canvas much less likely to land in an unrecoverable grey state.
 */
class RetryingSource implements Source {
  constructor(private readonly source: Source) {}

  getKey(): string {
    return this.source.getKey();
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= DEFAULT_PMTILES_RETRIES; attempt += 1) {
      try {
        return await this.source.getBytes(offset, length, signal, etag);
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
        if (attempt === DEFAULT_PMTILES_RETRIES) break;
        notifyBasemapIssue('retry', translate('basemap.tilesRetry'));
        await wait(200 * 2 ** attempt, signal);
      }
    }
    throw lastError;
  }
}

/**
 * Stores PMTiles byte ranges that have already been viewed. This is deliberately
 * a range cache rather than a full archive cache: it makes repeat opens and
 * low-detail/offline recovery resilient without attempting to download a
 * planet-scale basemap.
 */
class CachedSource implements Source {
  constructor(private readonly source: Source) {}

  getKey(): string {
    return this.source.getKey();
  }

  async getBytes(
    offset: number,
    length: number,
    signal?: AbortSignal,
    etag?: string,
  ): Promise<RangeResponse> {
    if (!('indexedDB' in globalThis)) {
      return this.source.getBytes(offset, length, signal, etag);
    }

    const key = cacheKey(this.source.getKey(), offset, length);
    const cached = await get<CachedRangeResponse>(key, basemapCache).catch(() => undefined);
    if (cached && Date.now() - cached.cachedAt <= BASEMAP_CACHE_MAX_AGE_MS) {
      void touchCachedRange(key);
      return fromCached(cached);
    }

    try {
      const response = await this.source.getBytes(offset, length, signal, etag);
      clearPendingFailureNotice();
      if (response.data.byteLength <= BASEMAP_CACHE_MAX_RANGE_BYTES) {
        await set(key, { ...response, cachedAt: Date.now() }, basemapCache).catch(() => undefined);
        void rememberCachedRange(key, response.data.byteLength);
      } else if (cached && Date.now() - cached.cachedAt > BASEMAP_CACHE_MAX_AGE_MS) {
        void forgetCachedRange(key);
      }
      return response;
    } catch (error) {
      if (cached) {
        clearPendingFailureNotice();
        notifyBasemapIssue('cached-fallback', translate('basemap.tilesCached'));
        return fromCached(cached);
      }
      scheduleFailureNotice();
      throw error;
    }
  }
}

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
 * On the Tauri desktop shell the default archive is pre-registered with a
 * native-fetch source so it resolves without browser CORS. Any other PMTiles URL
 * (custom user archives) falls through to pmtiles' own `FetchSource`, which
 * works whenever that host serves CORS — matching the web build's behavior.
 */
export function registerPmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  const source = isTauri()
    ? new TauriHttpSource(DEFAULT_PMTILES_URL)
    : new FetchSource(DEFAULT_PMTILES_URL);
  protocol.add(new PMTiles(new CachedSource(new RetryingSource(source))));
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}
