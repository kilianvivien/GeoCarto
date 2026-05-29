import { get, set as idbSet } from 'idb-keyval';
import type { DocumentFileBinding } from '@/state/documentStore';

const RECENTS_KEY = 'cartoproj:recents';
const MAX_RECENTS = 8;

export interface RecentProject {
  name: string;
  savedAt: string;
  /** File System Access handle stored verbatim — only present on Chromium. */
  handle: FileSystemFileHandle | null;
  /** Native filesystem path — only present on the Tauri desktop shell. */
  path?: string | null;
}

function hasIdb(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function readRecents(): Promise<RecentProject[]> {
  if (!hasIdb()) return [];
  try {
    const list = await get<RecentProject[]>(RECENTS_KEY);
    return Array.isArray(list) ? list.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

export async function rememberRecentProject(file: DocumentFileBinding): Promise<void> {
  if (!hasIdb() || !file?.name) return;
  try {
    const existing = await readRecents();
    const next: RecentProject = {
      name: file.name,
      savedAt: new Date().toISOString(),
      handle: file.handle ?? null,
      path: file.path ?? null,
    };
    // Dedupe by path (desktop), then handle (Chromium), else by name. Most recent wins.
    const filtered: RecentProject[] = [];
    for (const entry of existing) {
      let drop = false;
      if (file.path && entry.path) {
        drop = entry.path === file.path;
      } else if (file.handle && entry.handle) {
        try {
          const isSame = (entry.handle as unknown as {
            isSameEntry?: (other: FileSystemHandle) => Promise<boolean>;
          }).isSameEntry;
          drop = isSame ? await isSame.call(entry.handle, file.handle) : entry.name === file.name;
        } catch {
          drop = entry.name === file.name;
        }
      } else {
        drop = entry.name === file.name;
      }
      if (!drop) filtered.push(entry);
    }
    const updated = [next, ...filtered].slice(0, MAX_RECENTS);
    await idbSet(RECENTS_KEY, updated);
  } catch {
    // Recents are a nicety — never break a save on storage failure.
  }
}

export async function forgetRecentProject(name: string): Promise<void> {
  if (!hasIdb()) return;
  try {
    const existing = await readRecents();
    await idbSet(
      RECENTS_KEY,
      existing.filter((entry) => entry.name !== name),
    );
  } catch {
    // ignore
  }
}
