import { useEffect } from 'react';
import { del, entries, get, set as idbSet } from 'idb-keyval';
import type { CartoProject } from './cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { activeSessionId } from '@/state/sessionsStore';

/** Legacy single-session draft key (Phase 1) — still read on first launch
 *  so users with an existing draft don't lose it during the M8 upgrade. */
const LEGACY_AUTOSAVE_KEY = 'cartoproj:autosave:current';
const SESSION_PREFIX = 'cartoproj:autosave:session:';
const DEBOUNCE_MS = 10_000;

export interface AutosaveEntry {
  /** ISO timestamp when this draft was written. */
  savedAt: string;
  /** Filename the project was bound to when autosaved, if any. */
  fileName: string | null;
  /** The session id the draft was written under. Null for legacy drafts. */
  sessionId: string | null;
  project: CartoProject;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function keyFor(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

export async function readAutosave(sessionId: string): Promise<AutosaveEntry | null> {
  if (!hasIndexedDb()) return null;
  try {
    const value = await get<AutosaveEntry>(keyFor(sessionId));
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads every per-session autosave entry plus the legacy single-session draft.
 * The recovery UI uses this to offer every dirty session on startup, not just
 * the most recent.
 */
export async function readAllAutosaves(): Promise<AutosaveEntry[]> {
  if (!hasIndexedDb()) return [];
  try {
    const all = await entries<string, AutosaveEntry>();
    const sessionDrafts = all
      .filter(([k]) => typeof k === 'string' && k.startsWith(SESSION_PREFIX))
      .map(([, v]) => v);
    const legacy = await get<AutosaveEntry>(LEGACY_AUTOSAVE_KEY);
    if (legacy) sessionDrafts.push({ ...legacy, sessionId: null });
    return sessionDrafts.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function writeAutosave(entry: AutosaveEntry): Promise<void> {
  if (!hasIndexedDb()) return;
  if (!entry.sessionId) return; // never re-write the legacy slot
  try {
    await idbSet(keyFor(entry.sessionId), entry);
  } catch {
    // Storage failures (quota, private mode) shouldn't break editing.
  }
}

export async function clearAutosave(sessionId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await del(keyFor(sessionId));
  } catch {
    // ignore
  }
}

export async function clearLegacyAutosave(): Promise<void> {
  if (!hasIndexedDb()) return;
  try {
    await del(LEGACY_AUTOSAVE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Persist the active session's document to IndexedDB ~10s after the last
 * edit. Clears the draft on an explicit save and re-keys when the active
 * session changes.
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
        sessionId: activeSessionId(),
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
        // Explicit save just landed — clear any pending debounce and this
        // session's draft slot.
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        void clearAutosave(activeSessionId());
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
