import { X } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { useNotices } from './notices';

/** Bottom-centered toast stack (design.md §6d). Lives inside the window. */
export function ToastHost() {
  const notices = useNotices((s) => s.notices);
  const dismiss = useNotices((s) => s.dismiss);
  const t = useLocale((s) => s.t);

  if (notices.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-11 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-1.5"
    >
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
