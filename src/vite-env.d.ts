/// <reference types="vite/client" />

import type { useDocumentStore } from '@/state/documentStore';

declare global {
  interface Window {
    __documentStore: typeof useDocumentStore;
  }
}
