/**
 * Runtime platform detection so web and desktop can share one codebase while
 * branching at the few points where the host capabilities differ (file IO,
 * basemap fetching). The web build must stay at full feature parity — every
 * Tauri branch is additive and guarded by `isTauri()`.
 */

/**
 * True when running inside the Tauri (desktop) shell rather than a browser tab.
 * Tauri 2 injects `__TAURI_INTERNALS__` onto `window` before the app loads.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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
