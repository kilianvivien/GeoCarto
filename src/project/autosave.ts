import { useEffect } from 'react';
import { del, get, set as idbSet } from 'idb-keyval';
import type { CartoProject } from './cartoproj';
import { useDocumentStore } from '@/state/documentStore';

const AUTOSAVE_KEY = 'cartoproj:autosave:current';
const DEBOUNCE_MS = 10_000;

export interface AutosaveEntry {
  /** ISO timestamp when this draft was written. */
  savedAt: string;
  /** Filename the project was bound to when autosaved, if any. */
  fileName: string | null;
  project: CartoProject;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function readAutosave(): Promise<AutosaveEntry | null> {
  if (!hasIndexedDb()) return null;
  try {
    const value = await get<AutosaveEntry>(AUTOSAVE_KEY);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function writeAutosave(entry: AutosaveEntry): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await idbSet(AUTOSAVE_KEY, entry);
  } catch {
    // Storage failures (quota, private mode) shouldn't break editing.
  }
}

export async function clearAutosave(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await del(AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persist the document to IndexedDB ~10s after the last edit. Clears the draft
 * on an explicit save to disk and restores via `replaceProject`.
 */
export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const flush = () => {
      const { project, dirty, file } = useDocumentStore.getState();
      if (!dirty) return;
      void writeAutosave({
        savedAt: new Date().toISOString(),
        fileName: file?.name ?? null,
        project,
      });
    };

    const schedule = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    let lastProject = useDocumentStore.getState().project;
    let lastDirty = useDocumentStore.getState().dirty;
    const unsubscribe = useDocumentStore.subscribe((state) => {
      if (state.project !== lastProject && state.dirty) {
        schedule();
      } else if (!state.dirty && lastDirty) {
        // Explicit save just landed — clear any pending debounce and the draft.
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void clearAutosave();
      }
      lastProject = state.project;
      lastDirty = state.dirty;
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
