import { isTauri } from './platform';

/**
 * Register the offline-shell service worker (public/sw.js) so the web build
 * installs as a PWA on iPad and still opens without a network. Web-only and
 * production-only: the Tauri shell serves from its own protocol and needs no
 * SW, and dev servers must never fight a cached shell.
 */
export function registerServiceWorker(): void {
  if (isTauri() || !import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is progressive enhancement — a failed registration
      // (private browsing, unsupported context) must never surface as an error.
    });
  });
}
