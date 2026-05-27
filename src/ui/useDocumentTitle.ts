import { useEffect } from 'react';
import { useDocumentStore } from '@/state/documentStore';

/**
 * Mirror the active session into `document.title` so the browser tab label
 * tracks the current project (M8 acceptance: "Window title reflects the
 * active session"). Tauri will reuse this in M16.
 */
export function useDocumentTitle(): void {
  const name = useDocumentStore((s) => s.file?.name ?? s.project.meta.name ?? 'Untitled');
  const dirty = useDocumentStore((s) => s.dirty);
  useEffect(() => {
    const clean = name.replace(/\.cartoproj$/, '') || 'Untitled';
    document.title = `${dirty ? '• ' : ''}${clean} — GeoCarto`;
  }, [name, dirty]);
}
