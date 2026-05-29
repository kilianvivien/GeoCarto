import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  Github,
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
import { isTauri, openExternalUrl, REPO_URL } from '@/app/platform';
import { useTheme } from './useTheme';
import { hintHistoryLabel } from '@/state/historyStore';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';
import { useViewportStore } from '@/state/viewportStore';
import { openProjectFromDisk, saveProjectAs, saveProjectToDisk, UserCancelledError } from '@/project/fileSystem';
import { createNewProject, openProjectInNewTab } from '@/project/documentFlow';
import { rememberRecentProject } from '@/project/recents';
import { ExportDialog } from './ExportDialog';
import { RecentsMenu } from './RecentsMenu';
import { useHistoryStore } from '@/state/historyStore';
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
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const gridSnapEnabled = useToolStore((s) => s.gridSnapEnabled);
  const smartGuidesEnabled = useToolStore((s) => s.smartGuidesEnabled);
  const toggleMasterSnap = useToolStore((s) => s.toggleMasterSnap);
  const snapActive = gridSnapEnabled || smartGuidesEnabled;

  const handleSave = async (saveAs: boolean) => {
    const { project, file: currentFile, markSaved } = useDocumentStore.getState();
    try {
      const next = saveAs ? await saveProjectAs(project) : await saveProjectToDisk(project, currentFile);
      markSaved(next);
      void rememberRecentProject(next);
      push(`Saved ${next.name}`);
    } catch (error) {
      if (error instanceof UserCancelledError) return;
      push(error instanceof Error ? error.message : 'Save failed.', 'error');
    }
  };

  const handleLockToggle = () => {
    if (mode === 'editing') {
      unlockMapArea();
      return;
    }
    lockMapArea(viewport);
  };

  const handleOpen = async () => {
    try {
      const { project, file: opened } = await openProjectFromDisk();
      openProjectInNewTab(project, opened);
      void rememberRecentProject(opened);
      push(`Opened ${opened.name}`);
    } catch (error) {
      if (error instanceof UserCancelledError) return;
      push(error instanceof Error ? error.message : 'Open failed.', 'error');
    }
  };

  const handleNew = () => {
    createNewProject();
    push('Created new project');
  };

  const [sharing, setSharing] = useState(false);
  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const { project } = useDocumentStore.getState();
      const { exportRaster } = await import('@/export/raster');
      const scale = project.exportFrame.dpiScale ?? 1;
      const background = project.exportFrame.background ?? 'white';
      const result = await exportRaster(project, { format: 'png', scale, background, quality: 0.92 });
      const file = new File([result.blob], result.fileName, { type: 'image/png' });
      const navAny = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string }) => Promise<void>;
      };
      if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
        await navAny.share({ files: [file], title: result.fileName });
        push(`Shared ${result.fileName}`);
        return;
      }
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.blob })]);
        push(`Copied ${result.fileName} to clipboard`);
        return;
      }
      const { downloadBlob } = await import('@/export/raster');
      const saved = await downloadBlob(result.blob, result.fileName);
      if (saved) push(`Downloaded ${result.fileName}`);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return; // User cancelled the share sheet.
      push(error instanceof Error ? error.message : 'Share failed.', 'error');
    } finally {
      setSharing(false);
    }
  };

  const displayName = file?.name ?? `${projectName || 'Untitled'}.cartoproj`;
  const renameProject = useDocumentStore((s) => s.renameProject);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingName) setDraftName(projectName);
  }, [projectName, editingName]);

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== projectName) {
      hintHistoryLabel('Rename project');
      renameProject(next);
    }
    setEditingName(false);
  };

  // The bar doubles as the OS window drag region on desktop (data-tauri-drag-region);
  // it's an inert data attribute on the web. The leading inset (--titlebar-leading)
  // widens under Tauri so the centered title clears the native traffic lights that
  // the Overlay title bar draws over the top-left corner.
  return (
    <div
      data-tauri-drag-region
      className="flex h-11 items-center gap-3 border-b border-[var(--divider)] pr-3"
      style={{ paddingLeft: 'var(--titlebar-leading)' }}
    >
      <div className="mx-auto flex items-center gap-2 rounded-full px-3 py-1 text-[13px] transition-colors hover:bg-[var(--hover)]">
        <FileText size={14} className="text-[var(--text-3)]" />
        {editingName ? (
          <input
            ref={nameInputRef}
            autoFocus
            aria-label="Rename project"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraftName(projectName);
                setEditingName(false);
              }
            }}
            onFocus={(e) => e.currentTarget.select()}
            className="rounded-[6px] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[13px] font-medium text-[var(--text)] outline-none ring-1 ring-[var(--accent)]"
            style={{ minWidth: '8ch', width: `${Math.max(8, draftName.length + 1)}ch` }}
          />
        ) : (
          <button
            type="button"
            aria-label="Rename project"
            onClick={() => setEditingName(true)}
            onDoubleClick={() => setEditingName(true)}
            className="cursor-text font-medium text-[var(--text)]"
            title="Click to rename"
          >
            {displayName}
          </button>
        )}
        <span className="mono text-[var(--text-3)]">— {dirty ? 'Edited' : 'Saved'}</span>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="New project" onClick={handleNew}>
          <FilePlus2 size={16} />
        </IconButton>
        <IconButton label="Open project (⌘O)" onClick={handleOpen}>
          <FolderOpen size={16} />
        </IconButton>
        <RecentsMenu />
        <IconButton label="Save project (⌘S)" onClick={() => void handleSave(false)}>
          <Save size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-[var(--divider)]" />
        <IconButton label="Undo (⌘Z)" disabled={!canUndo} onClick={() => undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo (⌘⇧Z)" disabled={!canRedo} onClick={() => redo()}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton
          label={
            snapActive
              ? 'Snap on — disable smart guides + grid'
              : 'Snap off — enable smart guides + grid'
          }
          active={snapActive}
          onClick={toggleMasterSnap}
        >
          <Magnet size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-[var(--divider)]" />
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </IconButton>
        <IconButton
          label={sharing ? 'Sharing…' : 'Share map (PNG)'}
          disabled={mode !== 'editing' || sharing}
          onClick={() => void handleShare()}
        >
          <Share size={16} />
        </IconButton>
        <button
          type="button"
          onClick={handleLockToggle}
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
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          title="View source on GitHub"
          onClick={(e) => {
            // In the desktop shell, route through the OS opener so the webview
            // doesn't navigate away from the app; the web build uses the anchor.
            if (isTauri()) {
              e.preventDefault();
              void openExternalUrl(REPO_URL);
            }
          }}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Github size={16} />
        </a>
      </div>
      <ExportDialog open={exportOpen} onClose={closeExport} />
    </div>
  );
}
