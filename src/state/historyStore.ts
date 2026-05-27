import { create } from 'zustand';
import type { CartoProject } from '@/project/cartoproj';
import { useDocumentStore } from './documentStore';

const MAX_HISTORY = 100;

export interface HistoryEntry {
  label: string;
  snapshot: CartoProject;
}

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Coalesce window for continuous gestures (drag, slider scrub). */
  pendingLabel: string | null;
  pendingDeadline: number;
  pushEntry: (label: string, snapshot: CartoProject) => void;
  reset: (entries?: HistoryEntry[]) => void;
  undo: () => boolean;
  redo: () => boolean;
}

/**
 * Patch-free history: we push the immer-produced project root, which is
 * structurally shared with unchanged subtrees. A 100-step buffer on a 10 MB
 * dataset costs only the deltas the edits actually mutated.
 *
 * Selection / viewport / tool state stay out: they live in separate stores
 * (PRD §3 — the document is the only thing renderers project from).
 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  pendingLabel: null,
  pendingDeadline: 0,

  pushEntry: (label, snapshot) => {
    set((state) => ({
      past: [...state.past, { label, snapshot }].slice(-MAX_HISTORY),
      future: [],
    }));
  },

  reset: (entries = []) =>
    set({ past: entries.slice(-MAX_HISTORY), future: [], pendingLabel: null, pendingDeadline: 0 }),

  undo: () => {
    const { past } = get();
    if (past.length === 0) return false;
    const previous = past[past.length - 1];
    const current = useDocumentStore.getState().project;
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [...state.future, { label: previous.label, snapshot: current }],
      pendingLabel: null,
      pendingDeadline: 0,
    }));
    suspendHistoryCapture(() => {
      useDocumentStore.setState({ project: previous.snapshot, dirty: true });
    });
    return true;
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return false;
    const next = future[future.length - 1];
    const current = useDocumentStore.getState().project;
    set((state) => ({
      future: state.future.slice(0, -1),
      past: [...state.past, { label: next.label, snapshot: current }],
      pendingLabel: null,
      pendingDeadline: 0,
    }));
    suspendHistoryCapture(() => {
      useDocumentStore.setState({ project: next.snapshot, dirty: true });
    });
    return true;
  },
}));

const COALESCE_MS = 400;

/**
 * Run a mutation as a single undo step labelled `label`. Continuous bursts of
 * the same label inside the coalesce window collapse into one entry — drag a
 * marker 25 times, get one history step, not 25.
 *
 * @example
 *   withHistory('Drag annotation', () => updateAnnotation(id, { position }));
 */
export function withHistory<T>(label: string, fn: () => T): T {
  const before = useDocumentStore.getState().project;
  const result = fn();
  const after = useDocumentStore.getState().project;
  if (before === after) return result; // no-op mutation; don't pollute history

  const hist = useHistoryStore.getState();
  const now = Date.now();
  const shouldCoalesce =
    hist.pendingLabel === label && now < hist.pendingDeadline && hist.past.length > 0;

  if (shouldCoalesce) {
    useHistoryStore.setState({ pendingDeadline: now + COALESCE_MS });
  } else {
    hist.pushEntry(label, before);
    useHistoryStore.setState({ pendingLabel: label, pendingDeadline: now + COALESCE_MS });
  }

  return result;
}

/** Force-close the current coalesce window. Call on drag-end, blur, etc. */
export function commitHistoryGroup(): void {
  useHistoryStore.setState({ pendingLabel: null, pendingDeadline: 0 });
}

/**
 * Auto-record every mutation that changes `project` on the document store.
 * Mutations can hint a label via `hintHistoryLabel('Drag annotation')` before
 * the change; without a hint we fall back to "Edit".
 *
 * The hint is read once then cleared so a stale label can't leak into the
 * next mutation.
 */
let nextHint: string | null = null;
let suspended = false;

export function hintHistoryLabel(label: string): void {
  nextHint = label;
}

/** Used by undo/redo themselves so they don't push their own replay onto history. */
export function suspendHistoryCapture<T>(fn: () => T): T {
  suspended = true;
  try {
    return fn();
  } finally {
    suspended = false;
  }
}

export function installHistoryCapture(): () => void {
  let lastProject = useDocumentStore.getState().project;
  return useDocumentStore.subscribe((state) => {
    if (suspended) {
      lastProject = state.project;
      return;
    }
    if (state.project === lastProject) return;
    const before = lastProject;
    lastProject = state.project;

    // Push synchronously — by the time the subscriber runs, the new project
    // is already in state.
    const hist = useHistoryStore.getState();
    const label = nextHint ?? 'Edit';
    nextHint = null;
    const now = Date.now();
    const shouldCoalesce =
      hist.pendingLabel === label && now < hist.pendingDeadline && hist.past.length > 0;
    if (shouldCoalesce) {
      useHistoryStore.setState({ pendingDeadline: now + COALESCE_MS });
      return;
    }
    hist.pushEntry(label, before);
    useHistoryStore.setState({ pendingLabel: label, pendingDeadline: now + COALESCE_MS });
  });
}
