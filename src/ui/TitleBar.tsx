import {
  Download,
  FileText,
  FolderOpen,
  LockKeyhole,
  Magnet,
  Moon,
  Redo2,
  Save,
  Share,
  Sun,
  Undo2,
  UnlockKeyhole,
} from 'lucide-react';
import { useTheme } from './useTheme';
import { useDocumentStore } from '@/state/documentStore';
import { useViewportStore } from '@/state/viewportStore';
import { openProjectFromDisk, saveProjectAs, saveProjectToDisk, UserCancelledError } from '@/project/fileSystem';
import { ExportDialog } from './ExportDialog';
import { useNotices } from './notices';
import { useUiStore } from './uiStore';

function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors disabled:opacity-40 ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
      }`}
    >
      {children}
    </button>
  );
}

/** App title bar — global actions (design.md §4.1). */
export function TitleBar() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const mode = useDocumentStore((s) => s.project.mode);
  const projectName = useDocumentStore((s) => s.project.meta.name);
  const file = useDocumentStore((s) => s.file);
  const dirty = useDocumentStore((s) => s.dirty);
  const { lockMapArea, unlockMapArea } = useDocumentStore.getState();
  const viewport = useViewportStore((s) => s.viewport);
  const push = useNotices((s) => s.push);
  const exportOpen = useUiStore((s) => s.exportDialogOpen);
  const openExport = useUiStore((s) => s.openExportDialog);
  const closeExport = useUiStore((s) => s.closeExportDialog);

  const handleSave = async (saveAs: boolean) => {
    const { project, file: currentFile, markSaved } = useDocumentStore.getState();
    try {
      const next = saveAs ? await saveProjectAs(project) : await saveProjectToDisk(project, currentFile);
      markSaved(next);
      push(`Saved ${next.name}`);
    } catch (error) {
      if (error instanceof UserCancelledError) return;
      push(error instanceof Error ? error.message : 'Save failed.', 'error');
    }
  };

  const handleOpen = async () => {
    try {
      const { project, file: opened } = await openProjectFromDisk();
      useDocumentStore.getState().replaceProject(project, opened);
      push(`Opened ${opened.name}`);
    } catch (error) {
      if (error instanceof UserCancelledError) return;
      push(error instanceof Error ? error.message : 'Open failed.', 'error');
    }
  };

  const displayName = file?.name ?? `${projectName || 'Untitled'}.cartoproj`;

  return (
    <div className="flex h-11 items-center gap-3 border-b border-[var(--divider)] px-3">
      <div className="flex gap-2" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="mx-auto flex items-center gap-2 rounded-full px-3 py-1 text-[13px] transition-colors hover:bg-[var(--hover)]">
        <FileText size={14} className="text-[var(--text-3)]" />
        <span className="font-medium text-[var(--text)]">{displayName}</span>
        <span className="mono text-[var(--text-3)]">— {dirty ? 'Edited' : 'Saved'}</span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Open project (⌘O)" onClick={handleOpen}>
          <FolderOpen size={16} />
        </IconButton>
        <IconButton label="Save project (⌘S)" onClick={() => void handleSave(false)}>
          <Save size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-[var(--divider)]" />
        <IconButton label="Undo">
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo">
          <Redo2 size={16} />
        </IconButton>
        <IconButton label="Snap">
          <Magnet size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-[var(--divider)]" />
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <IconButton label="Share">
          <Share size={16} />
        </IconButton>
        <button
          type="button"
          onClick={() => (mode === 'editing' ? unlockMapArea() : lockMapArea(viewport))}
          className="ml-1 flex h-7 items-center gap-1.5 rounded-full bg-[var(--glass-thin)] px-3 text-[12px] font-medium text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
        >
          {mode === 'editing' ? <UnlockKeyhole size={14} /> : <LockKeyhole size={14} />}
          {mode === 'editing' ? 'Unlock Map' : 'Lock Map'}
        </button>
        <button
          type="button"
          onClick={openExport}
          disabled={mode !== 'editing'}
          title="Export (⌘E)"
          className="ml-1 flex h-7 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[12px] font-medium text-[var(--text-on-accent)] transition-[filter] hover:brightness-105 disabled:opacity-50"
        >
          <Download size={14} />
          Export
        </button>
      </div>
      <ExportDialog open={exportOpen} onClose={closeExport} />
    </div>
  );
}
