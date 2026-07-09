/**
 * Runtime platform detection so web and desktop can share one codebase while
 * branching at the few points where the host capabilities differ (file IO,
 * basemap fetching). The web build must stay at full feature parity — every
 * Tauri branch is additive and guarded by `isTauri()`.
 */

export const REPO_URL = 'https://github.com/kilianvivien/GeoCarto';

/**
 * True when running inside the Tauri (desktop) shell rather than a browser tab.
 * Tauri 2 injects `__TAURI_INTERNALS__` onto `window` before the app loads.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Conservative browser-side check for macOS. Used only to gate macOS-specific
 * desktop behaviour (native window vibrancy); a false negative just skips the
 * native effect and falls back to the CSS glass, so we err on the side of not
 * claiming macOS unless the platform clearly says so.
 */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaPlatform = (navigator as { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  if (uaPlatform) return /mac/i.test(uaPlatform);
  if (navigator.platform) return /mac/i.test(navigator.platform);
  return /Mac OS X|Macintosh/i.test(navigator.userAgent ?? '');
}

/**
 * Open an external URL in the user's default browser. On the web a normal new
 * tab works; under Tauri the webview would otherwise navigate away from the app,
 * so route through the opener plugin (additive desktop path, guarded by isTauri).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Last path segment of a native filesystem path (POSIX or Windows separators). */
export function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Fetch and parse a JSON endpoint. On desktop this routes through Tauri's HTTP
 * plugin (a native reqwest call) since third-party APIs commonly omit
 * `Access-Control-Allow-Origin` and a direct fetch from the `tauri://localhost`
 * origin would be blocked by CORS — the same reason pmtiles range requests do
 * (see `src/basemap/pmtiles.ts`). The web build uses the normal `fetch`.
 */
export async function fetchJson<T>(url: string, opts: { signal?: AbortSignal } = {}): Promise<T> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const response = await tauriFetch(url, { method: 'GET', signal: opts.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return (await response.json()) as T;
  }
  const response = await window.fetch(url, { signal: opts.signal });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}
