import { create } from 'zustand';
import type { CartoProject } from '@/project/cartoproj';
import { createEmptyProject } from '@/project/cartoproj';
import {
  useDocumentStore,
  type DocumentFileBinding,
  type SelectedFeature,
} from './documentStore';
import { suspendHistoryCapture, useHistoryStore, type HistoryEntry } from './historyStore';

/**
 * Per-session document snapshot. The *active* session keeps its live data in
 * `useDocumentStore`; every other tab is parked here in serialized form.
 *
 * Snapshots cover only the document store — viewport, tool state, and
 * selection inside other Zustand stores reset on tab switch by design,
 * matching how Figma resets transient UI per tab.
 */
export interface SessionSnapshot {
  project: CartoProject;
  file: DocumentFileBinding | null;
  selectedLayerId: string | null;
  selectedAnnotationId: string | null;
  selectedFeature: SelectedFeature | null;
  dirty: boolean;
  /** Per-session undo history — parked on tab switch so each tab feels native. */
  historyPast: HistoryEntry[];
}

export interface ProjectSession {
  id: string;
  /** Autosave key for IndexedDB — stable across rename. */
  autosaveKey: string;
  lastActiveAt: string;
  /** Snapshot is null for the *active* session (live state lives in the doc store). */
  snapshot: SessionSnapshot | null;
}

interface SessionsState {
  sessions: ProjectSession[];
  activeSessionId: string;
  newSession: (project?: CartoProject, file?: DocumentFileBinding | null) => string;
  switchTo: (id: string) => void;
  closeSession: (id: string) => boolean;
  reorder: (fromIndex: number, toIndex: number) => void;
  /** Used by tests/tooling to seed sessions on startup. */
  hydrate: (sessions: ProjectSession[], activeId: string) => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function snapshotKey(sessionId: string): string {
  return `cartoproj:autosave:session:${sessionId}`;
}

export function sessionTitle(session: ProjectSession): string {
  const view = session.snapshot;
  if (view) {
    const name = view.file?.name ?? view.project.meta.name ?? 'Untitled';
    return name.replace(/\.cartoproj$/, '') || 'Untitled';
  }
  // Active session — read from the live doc store.
  const live = useDocumentStore.getState();
  const name = live.file?.name ?? live.project.meta.name ?? 'Untitled';
  return name.replace(/\.cartoproj$/, '') || 'Untitled';
}

/**
 * Pull the live doc store down into a serializable snapshot. Cheap — store
 * payloads are plain Immer drafts referenced by structural sharing.
 */
function snapshotFromLive(): SessionSnapshot {
  const s = useDocumentStore.getState();
  return {
    project: s.project,
    file: s.file,
    selectedLayerId: s.selectedLayerId,
    selectedAnnotationId: s.selectedAnnotationId,
    selectedFeature: s.selectedFeature,
    dirty: s.dirty,
    historyPast: useHistoryStore.getState().past,
  };
}

/** Push a snapshot into the live doc store via its public setters. */
function hydrateLive(snapshot: SessionSnapshot): void {
  suspendHistoryCapture(() => {
    const doc = useDocumentStore.getState();
    doc.replaceProject(snapshot.project, snapshot.file ?? null);
    if (snapshot.selectedLayerId) doc.selectLayer(snapshot.selectedLayerId);
    if (snapshot.selectedAnnotationId) doc.selectAnnotation(snapshot.selectedAnnotationId);
    if (snapshot.selectedFeature) doc.selectFeature(snapshot.selectedFeature);
    if (snapshot.dirty) {
      useDocumentStore.setState({ dirty: true });
    }
  });
  useHistoryStore.getState().reset(snapshot.historyPast ?? []);
}

function makeFreshSession(
  project: CartoProject,
  file: DocumentFileBinding | null,
): ProjectSession {
  const id = makeId();
  return {
    id,
    autosaveKey: snapshotKey(id),
    lastActiveAt: new Date().toISOString(),
    snapshot: {
      project,
      file,
      selectedLayerId: null,
      selectedAnnotationId: null,
      selectedFeature: null,
      dirty: false,
      historyPast: [],
    },
  };
}

export const useSessionsStore = create<SessionsState>((set, get) => {
  // Build the bootstrap session from whatever the doc store already holds —
  // keeps Phase 1 startup behaviour unchanged.
  const initial = makeFreshSession(
    useDocumentStore.getState().project,
    useDocumentStore.getState().file,
  );
  initial.snapshot = null; // active session reads from live doc store

  return {
    sessions: [initial],
    activeSessionId: initial.id,

    newSession: (project, file = null) => {
      const next = makeFreshSession(project ?? createEmptyProject(), file ?? null);
      const previousActiveId = get().activeSessionId;
      // Park the currently active session before switching.
      const parkedSnapshot = snapshotFromLive();
      set((s) => ({
        sessions: s.sessions
          .map((session) =>
            session.id === previousActiveId
              ? { ...session, snapshot: parkedSnapshot, lastActiveAt: new Date().toISOString() }
              : session,
          )
          .concat({ ...next, snapshot: null, lastActiveAt: new Date().toISOString() }),
        activeSessionId: next.id,
      }));
      hydrateLive(next.snapshot!);
      return next.id;
    },

    switchTo: (id) => {
      const state = get();
      if (state.activeSessionId === id) return;
      const target = state.sessions.find((s) => s.id === id);
      if (!target || !target.snapshot) return;
      const parkedSnapshot = snapshotFromLive();
      set((s) => ({
        sessions: s.sessions.map((session) => {
          if (session.id === state.activeSessionId) {
            return { ...session, snapshot: parkedSnapshot, lastActiveAt: new Date().toISOString() };
          }
          if (session.id === id) {
            return { ...session, snapshot: null, lastActiveAt: new Date().toISOString() };
          }
          return session;
        }),
        activeSessionId: id,
      }));
      hydrateLive(target.snapshot);
    },

    closeSession: (id) => {
      const state = get();
      if (state.sessions.length === 1) {
        // Never leave the workspace without a tab — replace the only session
        // with a fresh blank one.
        const fresh = makeFreshSession(createEmptyProject(), null);
        fresh.snapshot = null;
        set({ sessions: [fresh], activeSessionId: fresh.id });
        hydrateLive({
          project: createEmptyProject(),
          file: null,
          selectedLayerId: null,
          selectedAnnotationId: null,
          selectedFeature: null,
          dirty: false,
          historyPast: [],
        });
        return true;
      }
      const remaining = state.sessions.filter((s) => s.id !== id);
      const nextActiveId =
        state.activeSessionId === id ? remaining[remaining.length - 1].id : state.activeSessionId;
      const switchingAway = state.activeSessionId === id;
      const parkedSnapshot = switchingAway ? null : snapshotFromLive();

      const updated = remaining.map((session) => {
        if (session.id === nextActiveId) {
          return { ...session, snapshot: null, lastActiveAt: new Date().toISOString() };
        }
        if (!switchingAway && session.id === state.activeSessionId) {
          return { ...session, snapshot: parkedSnapshot, lastActiveAt: new Date().toISOString() };
        }
        return session;
      });

      set({ sessions: updated, activeSessionId: nextActiveId });
      if (switchingAway) {
        const target = remaining.find((s) => s.id === nextActiveId);
        if (target?.snapshot) hydrateLive(target.snapshot);
      }
      return true;
    },

    reorder: (fromIndex, toIndex) => {
      set((s) => {
        const sessions = s.sessions.slice();
        const [moved] = sessions.splice(fromIndex, 1);
        sessions.splice(toIndex, 0, moved);
        return { sessions };
      });
    },

    hydrate: (sessions, activeId) => {
      set({ sessions, activeSessionId: activeId });
      const target = sessions.find((s) => s.id === activeId);
      if (target?.snapshot) hydrateLive(target.snapshot);
    },
  };
});

/**
 * Convenience for code outside React (file flows, autosave) — read the active
 * session id without subscribing.
 */
export function activeSessionId(): string {
  return useSessionsStore.getState().activeSessionId;
}
