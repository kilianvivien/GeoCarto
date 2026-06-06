import { useEffect } from 'react';
import { useDocumentStore } from '@/state/documentStore';
import { useLocale } from '@/i18n/useLocale';

/**
 * Mirror the active session into `document.title` so the browser tab label
 * tracks the current project (M8 acceptance: "Window title reflects the
 * active session"). Tauri will reuse this in M16.
 */
export function useDocumentTitle(): void {
  const t = useLocale((s) => s.t);
  const untitled = t('common.untitled');
  const name = useDocumentStore((s) => s.file?.name ?? s.project.meta.name ?? untitled);
  const dirty = useDocumentStore((s) => s.dirty);
  useEffect(() => {
    const clean = name.replace(/\.cartoproj$/, '') || untitled;
    document.title = `${dirty ? '• ' : ''}${clean} — GeoCarto`;
  }, [name, dirty, untitled]);
}
