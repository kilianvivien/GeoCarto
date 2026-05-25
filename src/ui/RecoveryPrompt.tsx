import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { clearAutosave, readAutosave, type AutosaveEntry } from '@/project/autosave';
import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from './notices';

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Offers to restore the most recent autosave draft on app startup. */
export function RecoveryPrompt() {
  const [entry, setEntry] = useState<AutosaveEntry | null>(null);
  const [hidden, setHidden] = useState(false);
  const replaceProject = useDocumentStore((s) => s.replaceProject);
  const push = useNotices((s) => s.push);

  useEffect(() => {
    let cancelled = false;
    readAutosave().then((value) => {
      if (cancelled) return;
      if (!value) return;
      // Only offer if the in-memory project hasn't been edited yet.
      if (useDocumentStore.getState().dirty) return;
      setEntry(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!entry || hidden) return null;

  const restore = () => {
    replaceProject(
      entry.project,
      entry.fileName ? { handle: null, name: entry.fileName } : null,
    );
    void clearAutosave();
    push('Restored autosaved draft');
    setHidden(true);
  };

  const discard = () => {
    void clearAutosave();
    setHidden(true);
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex justify-center">
      <div className="glass pointer-events-auto flex items-center gap-3 rounded-full bg-[var(--glass-strong)] py-1.5 pl-3 pr-1.5 text-[13px] text-[var(--text)]">
        <History size={14} className="text-[var(--accent)]" />
        <span>
          Unsaved draft from {formatTimestamp(entry.savedAt)}
          {entry.fileName ? <span className="text-[var(--text-3)]"> · {entry.fileName}</span> : null}
        </span>
        <button
          type="button"
          onClick={restore}
          className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={discard}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          aria-label="Discard draft"
          title="Discard draft"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
