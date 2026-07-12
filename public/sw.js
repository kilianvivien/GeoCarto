/*
 * GeoCarto offline-shell service worker (web/PWA build only — never registered
 * under Tauri, see src/app/registerServiceWorker.ts).
 *
 * Strategy:
 *  - Navigations: network-first, falling back to the cached app shell so an
 *    installed iPad PWA still opens offline.
 *  - Same-origin static assets (Vite's hashed /assets/*, icons, manifest):
 *    cache-first — hashed filenames make stale content impossible.
 *  - Everything else (basemap tiles, the /__geocarto_basemap PMTiles proxy,
 *    range requests, cross-origin, non-GET) is passed straight through: tile
 *    data is far too large to blanket-cache and range responses must not be
 *    served from a naive cache.
 */

const CACHE_NAME = 'geocarto-shell-v1';
const SHELL_URLS = [
  '/',
  '/manifest.webmanifest',
  '/app-icon.png',
  '/apple-touch-icon.png',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/app-icon.png' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.svg'
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // PMTiles archives are fetched with Range headers — never cache or intercept.
  if (url.pathname.startsWith('/__geocarto_basemap') || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
