import { useEffect } from 'react';
import { openProjectFromDisk, saveProjectAs, saveProjectToDisk, UserCancelledError } from '@/project/fileSystem';
import { createNewProject, openProjectInNewTab } from '@/project/documentFlow';
import { rememberRecentProject } from '@/project/recents';
import { useSessionsStore } from '@/state/sessionsStore';
import { useDocumentStore } from '@/state/documentStore';
import { useHistoryStore } from '@/state/historyStore';
import { isToolEnabled, SHORTCUT_TO_TOOL, useToolStore } from '@/state/toolStore';
import { useNotices } from './notices';
import { useUiStore } from './uiStore';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/** App-scoped keyboard shortcuts: tools, deletion, save/open/export. */
export function KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const cmd = event.metaKey || event.ctrlKey;

      if (cmd && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 's') {
          event.preventDefault();
          const { project, file, markSaved } = useDocumentStore.getState();
          const push = useNotices.getState().push;
          try {
            const next = event.shiftKey
              ? await saveProjectAs(project)
              : await saveProjectToDisk(project, file);
            markSaved(next);
            void rememberRecentProject(next);
            push(`Saved ${next.name}`);
          } catch (error) {
            if (error instanceof UserCancelledError) return;
            push(error instanceof Error ? error.message : 'Save failed.', 'error');
          }
          return;
        }
        if (key === 'o') {
          event.preventDefault();
          const push = useNotices.getState().push;
          try {
            const { project, file: opened } = await openProjectFromDisk();
            openProjectInNewTab(project, opened);
            void rememberRecentProject(opened);
            push(`Opened ${opened.name}`);
          } catch (error) {
            if (error instanceof UserCancelledError) return;
            push(error instanceof Error ? error.message : 'Open failed.', 'error');
          }
          return;
        }
        if (key === 'w') {
          // ⌘W closes the active tab; matches macOS browser muscle memory.
          event.preventDefault();
          const { activeSessionId, closeSession } = useSessionsStore.getState();
          if (useDocumentStore.getState().dirty) {
            const ok = window.confirm(
              'This tab has unsaved changes. Close and discard?',
            );
            if (!ok) return;
          }
          closeSession(activeSessionId);
          return;
        }
        if (key === 'n') {
          event.preventDefault();
          createNewProject();
          useNotices.getState().push('Created new project');
          return;
        }
        if (key === 'e') {
          event.preventDefault();
          if (useDocumentStore.getState().project.mode === 'editing') {
            useUiStore.getState().openExportDialog();
          }
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          const hist = useHistoryStore.getState();
          const ok = event.shiftKey ? hist.redo() : hist.undo();
          if (!ok) {
            useNotices
              .getState()
              .push(event.shiftKey ? 'Nothing to redo' : 'Nothing to undo', 'error');
          }
          return;
        }
        return;
      }

      if (event.altKey) return;
      if (useDocumentStore.getState().project.mode !== 'editing') return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const { selectedAnnotationId, removeAnnotation } = useDocumentStore.getState();
        if (selectedAnnotationId) {
          event.preventDefault();
          removeAnnotation(selectedAnnotationId);
        }
        return;
      }

      if (event.key === 'Escape') {
        useDocumentStore.getState().selectAnnotation(null);
        return;
      }

      const tool = SHORTCUT_TO_TOOL[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        if (!isToolEnabled(tool)) {
          const push = useNotices.getState().push;
          push('That tool is planned for Phase 2', 'error');
          return;
        }
        useToolStore.getState().setActiveTool(tool);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
