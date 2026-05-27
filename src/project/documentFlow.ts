import { clearAutosave } from './autosave';
import { createEmptyProject, type CartoProject } from './cartoproj';
import type { DocumentFileBinding } from '@/state/documentStore';
import { useDocumentStore } from '@/state/documentStore';

const DIRTY_PROMPT =
  'This project has unsaved changes. Continue and discard those changes?';

export function confirmDiscardDirtyProject(): boolean {
  if (!useDocumentStore.getState().dirty) return true;
  return window.confirm(DIRTY_PROMPT);
}

export function replaceCurrentProject(
  project: CartoProject,
  file?: DocumentFileBinding | null,
): void {
  useDocumentStore.getState().replaceProject(project, file);
  void clearAutosave();
}

export function createNewProject(): void {
  replaceCurrentProject(createEmptyProject(), null);
}
