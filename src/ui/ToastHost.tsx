import { Loader2, X } from 'lucide-react';
import { useImportProgress } from '@/import/importProgress';
import { useLocale } from '@/i18n/useLocale';
import { useNotices } from './notices';

/** Bottom-centered toast stack (design.md §6d). Lives inside the window. */
export function ToastHost() {
  const notices = useNotices((s) => s.notices);
  const dismiss = useNotices((s) => s.dismiss);
  const t = useLocale((s) => s.t);
  const importing = useImportProgress((s) => s.current);
  const cancelImport = useImportProgress((s) => s.cancel);

  if (notices.length === 0 && !importing) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-11 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-1.5"
    >
      {importing && (
        <div
          role="status"
          className="glass pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-[13px]"
        >
          <Loader2 size={13} className="animate-spin text-[var(--accent)] motion-reduce:animate-none" />
          <span className="max-w-[280px] truncate text-[var(--text)]">
            {importing.geocoding
              ? t('import.geocoding', { file: importing.file, ...importing.geocoding })
              : importing.total > 1
              ? t('import.statusBatch', { file: importing.file, index: importing.index, total: importing.total })
              : t('import.status', { file: importing.file })}
          </span>
          <button
            type="button"
            onClick={() => cancelImport?.()}
            className="rounded-full px-2.5 py-1 text-[12px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] pointer-coarse:px-3.5 pointer-coarse:py-2"
          >
            {t('import.cancel')}
          </button>
        </div>
      )}
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="glass pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px]"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: notice.tone === 'error' ? '#ff5f57' : 'var(--accent)' }}
          />
          <span className="text-[var(--text)]">{notice.message}</span>
          <button
            type="button"
            aria-label={t('toast.dismiss')}
            onClick={() => dismiss(notice.id)}
            className="text-[var(--text-3)] transition-colors hover:text-[var(--text)]"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
