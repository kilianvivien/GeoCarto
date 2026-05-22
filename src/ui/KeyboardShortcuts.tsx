import { useEffect } from 'react';
import { useDocumentStore } from '@/state/documentStore';
import { SHORTCUT_TO_TOOL, useToolStore } from '@/state/toolStore';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

/** App-scoped keyboard shortcuts for tool switching and annotation deletion. */
export function KeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

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
        useToolStore.getState().setActiveTool(tool);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
}
