import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { hintHistoryLabel } from '@/state/historyStore';
import { useSessionsStore, sessionTitle, type ProjectSession } from '@/state/sessionsStore';
import { useDocumentStore } from '@/state/documentStore';
import { createNewProject } from '@/project/documentFlow';
import { useLocale, translate } from '@/i18n/useLocale';
import { useNotices } from './notices';

function tabLabel(session: ProjectSession, isActive: boolean): string {
  if (isActive) {
    const live = useDocumentStore.getState();
    const fallback = translate('common.untitled');
    const name = live.file?.name ?? live.project.meta.name ?? fallback;
    return name.replace(/\.cartoproj$/, '') || fallback;
  }
  return sessionTitle(session);
}

function tabDirty(session: ProjectSession, isActive: boolean): boolean {
  if (isActive) return useDocumentStore.getState().dirty;
  return session.snapshot?.dirty ?? false;
}

/**
 * Project tab bar (M8). Sits between the title bar and the workspace. Drives
 * the sessions store: switch, close, reorder via drag, new tab.
 */
export function TabBar({ visible }: { visible: boolean }) {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeId = useSessionsStore((s) => s.activeSessionId);
  const switchTo = useSessionsStore((s) => s.switchTo);
  const closeSession = useSessionsStore((s) => s.closeSession);
  const reorder = useSessionsStore((s) => s.reorder);
  // Subscribe to the live doc store so the active tab's label and dirty
  // indicator refresh as the user types.
  const liveName = useDocumentStore((s) => s.file?.name ?? s.project.meta.name);
  const liveDirty = useDocumentStore((s) => s.dirty);
  const push = useNotices((s) => s.push);
  const t = useLocale((s) => s.t);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const renameProject = useDocumentStore((s) => s.renameProject);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) editInputRef.current.select();
  }, [editingTabId]);

  const commitTabRename = () => {
    const next = draftName.trim();
    if (next && editingTabId === activeId) {
      hintHistoryLabel('Rename project');
      renameProject(next);
    }
    setEditingTabId(null);
  };

  // Surface a single browser-level beforeunload guard for any dirty tab.
  useEffect(() => {
    const hasUnsaved = () =>
      useDocumentStore.getState().dirty ||
      useSessionsStore.getState().sessions.some((s) => s.snapshot?.dirty);
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleClose = (id: string, isActive: boolean) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const dirty = tabDirty(session, isActive);
    if (dirty && !window.confirm(t('tab.unsavedConfirm'))) return;
    closeSession(id);
  };

  return (
    <div
      role="tablist"
      aria-label={t('tab.projectTabs')}
      data-testid="tab-bar"
      aria-hidden={!visible}
      className={`flex h-9 items-end gap-1 overflow-hidden border-b border-[var(--divider)] bg-[var(--surface-base)] px-2 pt-1 transition-[opacity,transform] duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
      }`}
    >
      {sessions.map((session, index) => {
        const isActive = session.id === activeId;
        const label = tabLabel(session, isActive);
        const dirty = tabDirty(session, isActive);
        return (
          <button
            key={session.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive}
            data-testid="tab"
            draggable
            onDragStart={() => setDragFrom(index)}
            onDragOver={(e) => {
              if (dragFrom !== null) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== index) reorder(dragFrom, index);
              setDragFrom(null);
            }}
            onDragEnd={() => setDragFrom(null)}
            onClick={() => switchTo(session.id)}
            onDoubleClick={(e) => {
              e.preventDefault();
              if (!isActive) switchTo(session.id);
              setDraftName(label);
              setEditingTabId(session.id);
            }}
            className={`group relative flex h-8 max-w-[180px] items-center gap-2 rounded-t-[8px] px-3 text-[12px] transition-colors -mb-px ${
              isActive
                ? 'border border-b-transparent border-[var(--divider)] bg-[var(--surface-overlay)] font-semibold text-[var(--text)] shadow-[0_-2px_0_inset_var(--accent)]'
                : 'border border-transparent text-[var(--text-2)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
            }`}
            title={`${label}${dirty ? ` · ${t('tab.unsaved')}` : ''} — ${t('tab.doubleClickRename')}`}
          >
            {editingTabId === session.id ? (
              <input
                ref={editInputRef}
                autoFocus
                aria-label={t('tab.renameProject')}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitTabRename}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitTabRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingTabId(null);
                  }
                }}
                className="rounded-[4px] bg-[var(--surface-base)] px-1 text-[12px] outline-none ring-1 ring-[var(--accent)]"
                style={{ width: `${Math.max(6, draftName.length + 1)}ch` }}
              />
            ) : (
              <span className="truncate" data-tab-label data-tab-active={String(isActive)} data-tab-name={liveName && isActive ? liveName : undefined}>
                {label}
              </span>
            )}
            {(dirty || (isActive && liveDirty)) && (
              <span
                aria-hidden
                data-testid="tab-dirty"
                className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
              />
            )}
            <span
              role="button"
              aria-label={t('tab.close', { label })}
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleClose(session.id, isActive);
              }}
              className="rounded-full p-0.5 text-[var(--text-3)] opacity-0 transition-opacity hover:bg-[var(--hover)] hover:text-[var(--text)] group-hover:opacity-100"
            >
              <X size={11} />
            </span>
          </button>
        );
      })}
      <button
        type="button"
        aria-label={t('tab.newTab')}
        title={t('tab.newTab')}
        onClick={() => {
          createNewProject();
          push(t('tab.openedNewTab'));
        }}
        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-2)] hover:bg-[var(--hover)]"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
