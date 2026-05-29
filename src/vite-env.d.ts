/// <reference types="vite/client" />

import type { useDocumentStore } from '@/state/documentStore';

declare global {
  interface Window {
    __documentStore: typeof useDocumentStore;
  }

  /** App version, injected from package.json at build time (see vite.config.ts). */
  const __APP_VERSION__: string;
}
