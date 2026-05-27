import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { readRecents, forgetRecentProject, type RecentProject } from '@/project/recents';
import { deserializeProject } from '@/project/serialize';
import { openProjectInNewTab } from '@/project/documentFlow';
import { useNotices } from './notices';

async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const queryable = handle as unknown as {
    queryPermission?: (desc: { mode: 'read' }) => Promise<PermissionState>;
    requestPermission?: (desc: { mode: 'read' }) => Promise<PermissionState>;
  };
  try {
    const status = (await queryable.queryPermission?.({ mode: 'read' })) ?? 'prompt';
    if (status === 'granted') return true;
    const next = (await queryable.requestPermission?.({ mode: 'read' })) ?? 'denied';
    return next === 'granted';
  } catch {
    return false;
  }
}

/**
 * Recent projects dropdown (M8). Stores File System Access handles where the
 * browser provides them so users can reopen with one click; Safari/Firefox
 * fall back to a filename-only history.
 */
export function RecentsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RecentProject[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const push = useNotices((s) => s.push);

  useEffect(() => {
    if (open) void readRecents().then(setItems);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClick = async (recent: RecentProject) => {
    setOpen(false);
    if (!recent.handle) {
      push('This browser cannot re-open files directly — use Open.', 'error');
      return;
    }
    try {
      if (!(await ensurePermission(recent.handle))) {
        push('Permission denied for that file.', 'error');
        return;
      }
      const file = await recent.handle.getFile();
      const text = await file.text();
      const project = deserializeProject(text);
      openProjectInNewTab(project, { handle: recent.handle, name: recent.handle.name });
      push(`Opened ${recent.handle.name}`);
    } catch (error) {
      // File was moved/deleted on disk — drop it from history.
      await forgetRecentProject(recent.name);
      push(error instanceof Error ? error.message : 'Could not reopen file.', 'error');
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Recent projects"
        title="Recent projects"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1 rounded-[8px] px-1.5 text-[var(--text-2)] transition-colors hover:bg-[var(--hover)]"
      >
        <Clock size={14} />
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          role="menu"
          data-testid="recents-menu"
          className="glass absolute right-0 top-9 z-50 w-[280px] rounded-[10px] bg-[var(--surface-modal)] p-1 text-[12px] text-[var(--text)] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
        >
          {items.length === 0 ? (
            <div className="px-3 py-2 text-[var(--text-3)]">No recent projects yet.</div>
          ) : (
            items.map((item) => (
              <button
                key={item.name + item.savedAt}
                type="button"
                role="menuitem"
                data-testid="recent-entry"
                onClick={() => void handleClick(item)}
                className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
              >
                <span className="truncate">{item.name}</span>
                {!item.handle && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-3)]">
                    history
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
