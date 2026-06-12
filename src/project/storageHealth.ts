import { create } from 'zustand';
import { entries, get } from 'idb-keyval';

const SESSION_PREFIX = 'cartoproj:autosave:session:';
const LEGACY_AUTOSAVE_KEY = 'cartoproj:autosave:current';
const RECENTS_KEY = 'cartoproj:recents';

export type StorageIssueKind = 'autosave' | 'recents' | 'quota' | 'unavailable';

export interface StorageIssue {
  kind: StorageIssueKind;
  message: string;
  at: string;
}

export interface StorageHealthSnapshot {
  available: boolean;
  usage: number | null;
  quota: number | null;
  draftCount: number;
  recentCount: number;
  issues: StorageIssue[];
  checkedAt: string | null;
}

interface StorageHealthState extends StorageHealthSnapshot {
  recordIssue: (kind: StorageIssueKind, message: string) => void;
  refresh: () => Promise<void>;
}

const initial: StorageHealthSnapshot = {
  available: typeof indexedDB !== 'undefined',
  usage: null,
  quota: null,
  draftCount: 0,
  recentCount: 0,
  issues: [],
  checkedAt: null,
};

async function inspectStorage(issues: StorageIssue[]): Promise<StorageHealthSnapshot> {
  if (typeof indexedDB === 'undefined') {
    return {
      ...initial,
      available: false,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  let draftCount = 0;
  let recentCount = 0;
  try {
    const all = await entries<string, unknown>();
    draftCount = all.filter(([key]) => key === LEGACY_AUTOSAVE_KEY || key.startsWith(SESSION_PREFIX)).length;
    const recents = await get<unknown>(RECENTS_KEY);
    recentCount = Array.isArray(recents) ? recents.length : 0;
  } catch (error) {
    issues = [
      {
        kind: 'unavailable' as const,
        message: error instanceof Error ? error.message : 'IndexedDB unavailable',
        at: new Date().toISOString(),
      },
      ...issues,
    ].slice(0, 5);
  }

  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  const usage = typeof estimate?.usage === 'number' ? estimate.usage : null;
  const quota = typeof estimate?.quota === 'number' ? estimate.quota : null;
  const lowHeadroom = usage != null && quota != null && quota > 0 && quota - usage < quota * 0.1;
  const nextIssues =
    lowHeadroom && !issues.some((issue) => issue.kind === 'quota')
      ? [
          {
            kind: 'quota' as const,
            message: 'Storage quota is nearly full',
            at: new Date().toISOString(),
          },
          ...issues,
        ].slice(0, 5)
      : issues;

  return {
    available: true,
    usage,
    quota,
    draftCount,
    recentCount,
    issues: nextIssues,
    checkedAt: new Date().toISOString(),
  };
}

export const useStorageHealth = create<StorageHealthState>((set, get) => ({
  ...initial,
  recordIssue: (kind, message) =>
    set((state) => ({
      issues: [{ kind, message, at: new Date().toISOString() }, ...state.issues].slice(0, 5),
    })),
  refresh: async () => {
    const snapshot = await inspectStorage(get().issues);
    set(snapshot);
  },
}));

export function reportStorageIssue(kind: StorageIssueKind, message: string): void {
  useStorageHealth.getState().recordIssue(kind, message);
}
