import { useEffect } from 'react';
import { isTauri } from '@/app/platform';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { SHORTCUT_TO_TOOL } from '@/state/toolStore';
import { type AppCommand, runAppCommand } from '@/app/appCommands';
import { useMapInstance } from '@/canvas/mapInstance';

declare global {
  interface Window {
    __geocartoTauriMenuListenerInstalled?: boolean;
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function ensureTauriMenuListener(): void {
  if (!isTauri() || window.__geocartoTauriMenuListenerInstalled) return;
  window.__geocartoTauriMenuListenerInstalled = true;
  void import('@tauri-apps/api/event').then(({ listen }) => {
    const runMenuCommand = (event: { payload: AppCommand }) => {
      void runAppCommand(event.payload);
    };
    void listen<AppCommand>('geocarto-menu', runMenuCommand);
    // Compatibility with desktop builds that emitted the older global event.
    void listen<AppCommand>('geocarto://menu', runMenuCommand);
  });
}

/** App-scoped keyboard shortcuts: tools, deletion, save/open/export. */
export function KeyboardShortcuts() {
  useEffect(() => {
    ensureTauriMenuListener();
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const cmd = event.metaKey || event.ctrlKey;

      if (cmd && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 's') {
          event.preventDefault();
          await runAppCommand(event.shiftKey ? 'save-project-as' : 'save-project');
          return;
        }
        if (key === 'o') {
          event.preventDefault();
          if (event.shiftKey) await runAppCommand('import-data');
          else await runAppCommand('open-project');
          return;
        }
        if (key === 'w') {
          // ⌘W closes the active tab; matches macOS browser muscle memory.
          event.preventDefault();
          await runAppCommand('close-tab');
          return;
        }
        if (key === 'n') {
          event.preventDefault();
          await runAppCommand('new-project');
          return;
        }
        if (key === ',') {
          event.preventDefault();
          await runAppCommand('open-settings');
          return;
        }
        if (key === 'k') {
          event.preventDefault();
          await runAppCommand('open-command-palette');
          return;
        }
        if (key === 'f' && event.shiftKey) {
          event.preventDefault();
          await runAppCommand('go-to-place');
          return;
        }
        if (key === 'e') {
          event.preventDefault();
          await runAppCommand(event.shiftKey ? 'share-png' : 'export');
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          await runAppCommand(event.shiftKey ? 'redo' : 'undo');
          return;
        }
        if (key === 'g') {
          event.preventDefault();
          await runAppCommand(event.shiftKey ? 'ungroup-selection' : 'group-selection');
          return;
        }
        return;
      }

      if (event.altKey) return;
      if (useDocumentStore.getState().project.mode !== 'editing') return;

      if (event.key.startsWith('Arrow')) {
        const { project, selectedAnnotationIds, moveAnnotations } = useDocumentStore.getState();
        if (selectedAnnotationIds.length === 0) return;
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        };
        const projection = useMapInstance.getState().projection;
        const moves = project.annotations
          .filter((annotation) => selectedAnnotationIds.includes(annotation.id) && !annotation.locked)
          .map((annotation) => {
            const current =
              annotation.anchorMode === 'map' && annotation.geoAnchor && projection
                ? projection.project(annotation.geoAnchor) ?? annotation.position
                : annotation.position;
            const position = { x: current.x + delta.x, y: current.y + delta.y };
            return {
              id: annotation.id,
              position,
              geoAnchor:
                annotation.anchorMode === 'map' && projection
                  ? projection.unproject(position)
                  : undefined,
            };
          });
        if (moves.length > 0) {
          event.preventDefault();
          hintHistoryLabel('Nudge selection');
          moveAnnotations(moves);
        }
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const edit = useEditStore.getState();
        if (edit.editingLayerId && edit.selectedFeatureId != null) {
          event.preventDefault();
          hintHistoryLabel('Delete feature');
          useDocumentStore.getState().removeFeature(edit.editingLayerId, edit.selectedFeatureId);
          edit.selectFeature(null);
          return;
        }
        if (useDocumentStore.getState().selectedAnnotationId) {
          event.preventDefault();
          await runAppCommand('delete-selection');
        }
        return;
      }

      if (event.key === 'Escape') {
        if (useEditStore.getState().editingLayerId) {
          useEditStore.getState().exitEdit();
          return;
        }
        useDocumentStore.getState().selectAnnotation(null);
        return;
      }

      // While a layer is open in the vector editor, single-letter keys belong to
      // terra-draw (e.g. hold R/S to rotate/scale) — don't hijack them to switch
      // annotation tools, which are blocked during vector editing anyway.
      if (useEditStore.getState().editingLayerId) return;

      const tool = SHORTCUT_TO_TOOL[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        await runAppCommand(`tool-${tool}`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
