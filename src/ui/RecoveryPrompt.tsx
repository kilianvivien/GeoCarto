import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import {
  clearAutosave,
  clearLegacyAutosave,
  readAllAutosaves,
  type AutosaveEntry,
} from '@/project/autosave';
import { openProjectInNewTab, replaceCurrentProject } from '@/project/documentFlow';
import { useDocumentStore } from '@/state/documentStore';
import { useLocale } from '@/i18n/useLocale';
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

/**
 * Offers to restore every autosaved draft on app startup (M8: per-session
 * recovery). Each draft restores into its own tab so the user can fan out
 * recovered work — matches the acceptance "every dirty session, not just
 * the last active one".
 */
export function RecoveryPrompt() {
  const [entries, setEntries] = useState<AutosaveEntry[]>([]);
  const [hidden, setHidden] = useState(false);
  const push = useNotices((s) => s.push);
  const t = useLocale((s) => s.t);

  useEffect(() => {
    let cancelled = false;
    readAllAutosaves().then((all) => {
      if (cancelled || all.length === 0) return;
      // Only offer if the in-memory project hasn't been edited yet — restoring
      // over live work would surprise the user.
      if (useDocumentStore.getState().dirty) return;
      setEntries(all);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0 || hidden) return null;

  const restoreOne = async (entry: AutosaveEntry) => {
    const binding = entry.fileName ? { handle: null, name: entry.fileName } : null;
    // First entry replaces the blank startup tab; the rest open as new tabs
    // so the user can switch between recovered drafts.
    if (entries[0] === entry) {
      replaceCurrentProject(entry.project, binding);
    } else {
      openProjectInNewTab(entry.project, binding);
    }
    if (entry.sessionId) await clearAutosave(entry.sessionId);
    else await clearLegacyAutosave();
    setEntries((current) => current.filter((e) => e !== entry));
    push(t('recovery.restored', { name: entry.fileName ?? t('recovery.autosavedDraft') }));
  };

  const restoreAll = async () => {
    for (const entry of entries) {
      await restoreOne(entry);
    }
    setHidden(true);
  };

  const discardAll = async () => {
    for (const entry of entries) {
      if (entry.sessionId) await clearAutosave(entry.sessionId);
      else await clearLegacyAutosave();
    }
    setHidden(true);
  };

  // Single-draft case mirrors the Phase 1 compact pill — no per-entry list,
  // no duplicate Restore button.
  if (entries.length === 1) {
    const only = entries[0];
    const onlyLabel = only.fileName ?? only.project.meta.name ?? t('common.untitled');
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center">
        <div
          data-testid="recovery-prompt"
          className="glass pointer-events-auto flex items-center gap-3 rounded-full bg-[var(--glass-strong)] py-1.5 pl-3 pr-1.5 text-[13px] text-[var(--text)]"
        >
          <History size={14} className="text-[var(--accent)]" />
          <span>
            {t('recovery.unsavedDraftFrom', { timestamp: formatTimestamp(only.savedAt) })}
            <span className="text-[var(--text-3)]"> · {onlyLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => void restoreOne(only)}
            className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105"
          >
            {t('recovery.restore')}
          </button>
          <button
            type="button"
            onClick={() => void discardAll()}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
            aria-label={t('recovery.discardDraft')}
            title={t('recovery.discardDraft')}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-40 flex justify-center">
      <div
        data-testid="recovery-prompt"
        className="glass pointer-events-auto flex max-w-[520px] flex-col gap-2 rounded-[12px] bg-[var(--glass-strong)] p-3 text-[13px] text-[var(--text)]"
      >
        <div className="flex items-center gap-2">
          <History size={14} className="text-[var(--accent)]" />
          <span className="font-medium">
            {entries.length === 1
              ? t('recovery.unsavedDraft')
              : t('recovery.unsavedDrafts', { n: entries.length })}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void restoreAll()}
            className="rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-semibold text-[var(--text-on-accent)] transition-[filter] hover:brightness-105"
          >
            {entries.length === 1 ? t('recovery.restore') : t('recovery.restoreAll')}
          </button>
          <button
            type="button"
            onClick={() => void discardAll()}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
            aria-label={t('recovery.discardAll')}
            title={t('recovery.discardAll')}
          >
            <X size={14} />
          </button>
        </div>
        <ul className="m-0 grid gap-1 p-0">
          {entries.map((entry) => (
            <li
              key={(entry.sessionId ?? 'legacy') + entry.savedAt}
              data-testid="recovery-entry"
              className="flex items-center gap-2 rounded-[8px] bg-[var(--surface-overlay)] px-2 py-1"
            >
              <span className="flex-1 truncate">
                {entry.fileName ?? entry.project.meta.name ?? t('common.untitled')}
                <span className="ml-2 text-[var(--text-3)]">{formatTimestamp(entry.savedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => void restoreOne(entry)}
                className="rounded-full px-2 py-0.5 text-[11px] text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                {t('recovery.restore')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
