import { clearAutosave } from './autosave';
import { createEmptyProject, type CartoProject } from './cartoproj';
import type { DocumentFileBinding } from '@/state/documentStore';
import { useDocumentStore } from '@/state/documentStore';
import { suspendHistoryCapture, useHistoryStore } from '@/state/historyStore';
import { activeSessionId, useSessionsStore } from '@/state/sessionsStore';
import { translate } from '@/i18n/useLocale';

export function confirmDiscardDirtyProject(): boolean {
  if (!useDocumentStore.getState().dirty) return true;
  return window.confirm(translate('confirm.dirtyPrompt'));
}

/**
 * Replace the active session's project in place. Used by Open and Restore
 * when the user is intentionally swapping the contents of the current tab
 * rather than opening a new one.
 */
export function replaceCurrentProject(
  project: CartoProject,
  file?: DocumentFileBinding | null,
): void {
  suspendHistoryCapture(() => {
    useDocumentStore.getState().replaceProject(project, file);
  });
  useHistoryStore.getState().reset();
  void clearAutosave(activeSessionId());
}

/**
 * Open the project in a fresh tab so multi-project workflows compose
 * naturally — matches M8 acceptance: "User can open three projects, switch
 * freely".
 */
export function openProjectInNewTab(
  project: CartoProject,
  file: DocumentFileBinding | null,
): string {
  return useSessionsStore.getState().newSession(project, file);
}

export function createNewProject(): void {
  useSessionsStore.getState().newSession(createEmptyProject(), null);
}
