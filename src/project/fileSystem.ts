import type { CartoProject } from './cartoproj';
import type { DocumentFileBinding } from '@/state/documentStore';
import { deserializeProject, ProjectLoadError, serializeProject } from './serialize';
import { basename, isTauri } from '@/app/platform';
import { translate } from '@/i18n/useLocale';

function fileType() {
  return {
    description: translate('file.projectType'),
    accept: { 'application/json': ['.cartoproj'] as string[] },
  };
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
  }
}

function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export class UserCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'UserCancelledError';
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function suggestedFileName(project: CartoProject): string {
  const base = project.meta.name?.trim() || translate('common.untitled');
  return base.endsWith('.cartoproj') ? base : `${base}.cartoproj`;
}

async function writeHandle(handle: FileSystemFileHandle, contents: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

function downloadBlob(name: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Defer revocation so the navigation has time to start in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Desktop save via Tauri's native dialog + filesystem. Writes in place when the
 * project already has a path; otherwise prompts for a destination.
 */
async function saveProjectViaTauri(
  project: CartoProject,
  contents: string,
  existing?: DocumentFileBinding | null,
): Promise<DocumentFileBinding> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');

  if (existing?.path) {
    await writeTextFile(existing.path, contents);
    return { handle: null, path: existing.path, name: existing.name };
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({
    defaultPath: suggestedFileName(project),
    filters: [{ name: translate('file.projectType'), extensions: ['cartoproj'] }],
  });
  if (!path) throw new UserCancelledError();
  await writeTextFile(path, contents);
  return { handle: null, path, name: basename(path) };
}

async function validateDesktopBasemap(project: CartoProject): Promise<void> {
  if (project.basemap.kind !== 'pmtiles-file') return;
  const { exists } = await import('@tauri-apps/plugin-fs');
  if (!(await exists(project.basemap.path))) {
    throw new ProjectLoadError(translate('basemap.localMissing', { path: project.basemap.path }));
  }
}

/**
 * Save the project. If `existing` carries a handle (FSA) or path (desktop),
 * write in place. Otherwise prompt for a destination (native dialog / FSA) or
 * trigger a browser download.
 */
export async function saveProjectToDisk(
  project: CartoProject,
  existing?: DocumentFileBinding | null,
): Promise<DocumentFileBinding> {
  const contents = serializeProject(project);
  const name = existing?.name ?? suggestedFileName(project);

  if (isTauri()) return saveProjectViaTauri(project, contents, existing);

  if (existing?.handle) {
    await writeHandle(existing.handle, contents);
    return { handle: existing.handle, name };
  }

  if (hasFileSystemAccess()) {
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName: name,
        types: [fileType()],
      });
      await writeHandle(handle, contents);
      return { handle, name: handle.name };
    } catch (error) {
      if (isCancellation(error)) throw new UserCancelledError();
      throw error;
    }
  }

  downloadBlob(name, contents);
  return { handle: null, name };
}

/** Always prompt for a destination, even if `existing` has a handle. */
export async function saveProjectAs(project: CartoProject): Promise<DocumentFileBinding> {
  return saveProjectToDisk(project, null);
}

export interface OpenResult {
  project: CartoProject;
  file: DocumentFileBinding;
}

async function pickFsaFile(): Promise<{ handle: FileSystemFileHandle; file: File } | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({
      multiple: false,
      types: [fileType()],
    });
    if (!handle) return null;
    const file = await handle.getFile();
    return { handle, file };
  } catch (error) {
    if (isCancellation(error)) throw new UserCancelledError();
    throw error;
  }
}

function pickFallbackFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.cartoproj,application/json';
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export async function openProjectFromDisk(): Promise<OpenResult> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: translate('file.projectType'), extensions: ['cartoproj'] }],
    });
    if (typeof path !== 'string') throw new UserCancelledError();
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    const text = await readTextFile(path);
    const project = deserializeProject(text);
    await validateDesktopBasemap(project);
    return { project, file: { handle: null, path, name: basename(path) } };
  }

  if (hasFileSystemAccess()) {
    const picked = await pickFsaFile();
    if (!picked) throw new UserCancelledError();
    const text = await picked.file.text();
    const project = deserializeProject(text);
    return { project, file: { handle: picked.handle, name: picked.handle.name } };
  }

  const file = await pickFallbackFile();
  if (!file) throw new UserCancelledError();
  const text = await file.text();
  const project = deserializeProject(text);
  return { project, file: { handle: null, name: file.name } };
}

export { ProjectLoadError };
