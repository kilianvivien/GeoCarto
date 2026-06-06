import { pickAndImportGeoJson } from '@/import/importLayers';
import { openExternalUrl, REPO_URL } from '@/app/platform';
import { createNewProject, openProjectInNewTab } from '@/project/documentFlow';
import { openProjectFromDisk, saveProjectAs, saveProjectToDisk, UserCancelledError } from '@/project/fileSystem';
import { rememberRecentProject } from '@/project/recents';
import { useDocumentStore } from '@/state/documentStore';
import { hintDiscreteHistoryLabel, useHistoryStore } from '@/state/historyStore';
import { useSessionsStore } from '@/state/sessionsStore';
import { isToolEnabled, type ToolKey, useToolStore } from '@/state/toolStore';
import { useViewTransformStore } from '@/state/viewTransformStore';
import { useViewportStore } from '@/state/viewportStore';
import { useNotices } from '@/ui/notices';
import { useTheme } from '@/ui/useTheme';
import { useUiStore } from '@/ui/uiStore';

export type AppCommand =
  | 'new-project'
  | 'open-project'
  | 'import-data'
  | 'save-project'
  | 'save-project-as'
  | 'export'
  | 'share-png'
  | 'close-tab'
  | 'undo'
  | 'redo'
  | 'delete-selection'
  | 'group-selection'
  | 'ungroup-selection'
  | 'toggle-theme'
  | 'toggle-snap'
  | 'toggle-map-lock'
  | 'open-github'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | `tool-${ToolKey}`;

async function saveProject(saveAs: boolean): Promise<void> {
  const { project, file, markSaved } = useDocumentStore.getState();
  const push = useNotices.getState().push;
  try {
    const next = saveAs ? await saveProjectAs(project) : await saveProjectToDisk(project, file);
    markSaved(next);
    void rememberRecentProject(next);
    push(`Saved ${next.name}`);
  } catch (error) {
    if (error instanceof UserCancelledError) return;
    push(error instanceof Error ? error.message : 'Save failed.', 'error');
  }
}

async function openProject(): Promise<void> {
  const push = useNotices.getState().push;
  try {
    const { project, file } = await openProjectFromDisk();
    openProjectInNewTab(project, file);
    void rememberRecentProject(file);
    push(`Opened ${file.name}`);
  } catch (error) {
    if (error instanceof UserCancelledError) return;
    push(error instanceof Error ? error.message : 'Open failed.', 'error');
  }
}

async function sharePng(): Promise<void> {
  const push = useNotices.getState().push;
  const { project } = useDocumentStore.getState();
  if (project.mode !== 'editing') return;

  try {
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
    if ((error as Error).name === 'AbortError') return;
    push(error instanceof Error ? error.message : 'Share failed.', 'error');
  }
}

function closeActiveTab(): void {
  const { activeSessionId, closeSession } = useSessionsStore.getState();
  if (useDocumentStore.getState().dirty) {
    const ok = window.confirm('This tab has unsaved changes. Close and discard?');
    if (!ok) return;
  }
  closeSession(activeSessionId);
}

function toggleMapLock(): void {
  const document = useDocumentStore.getState();
  if (document.project.mode === 'editing') {
    document.unlockMapArea();
    return;
  }
  document.lockMapArea(useViewportStore.getState().viewport);
}

function zoomBy(factor: number): void {
  if (useDocumentStore.getState().project.mode !== 'editing') return;
  useViewTransformStore.getState().zoomBy(factor, {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}

export async function runAppCommand(command: AppCommand): Promise<void> {
  const push = useNotices.getState().push;

  if (command.startsWith('tool-')) {
    const tool = command.slice(5) as ToolKey;
    if (!isToolEnabled(tool)) {
      push('That tool is planned for Phase 2', 'error');
      return;
    }
    useToolStore.getState().setActiveTool(tool);
    return;
  }

  switch (command) {
    case 'new-project':
      createNewProject();
      push('Created new project');
      break;
    case 'open-project':
      await openProject();
      break;
    case 'import-data':
      if (useDocumentStore.getState().project.mode === 'editing') pickAndImportGeoJson();
      break;
    case 'save-project':
      await saveProject(false);
      break;
    case 'save-project-as':
      await saveProject(true);
      break;
    case 'export':
      if (useDocumentStore.getState().project.mode === 'editing') useUiStore.getState().openExportDialog();
      break;
    case 'share-png':
      await sharePng();
      break;
    case 'close-tab':
      closeActiveTab();
      break;
    case 'undo':
      if (!useHistoryStore.getState().undo()) push('Nothing to undo', 'error');
      break;
    case 'redo':
      if (!useHistoryStore.getState().redo()) push('Nothing to redo', 'error');
      break;
    case 'delete-selection':
      {
        const { selectedAnnotationId, removeAnnotation } = useDocumentStore.getState();
        if (selectedAnnotationId) {
          hintDiscreteHistoryLabel('Delete annotation');
          removeAnnotation(selectedAnnotationId);
        }
      }
      break;
    case 'group-selection':
      useDocumentStore.getState().groupSelectedAnnotations();
      break;
    case 'ungroup-selection':
      useDocumentStore.getState().ungroupSelectedAnnotations();
      break;
    case 'toggle-theme':
      useTheme.getState().toggleTheme();
      break;
    case 'toggle-snap':
      useToolStore.getState().toggleMasterSnap();
      break;
    case 'toggle-map-lock':
      toggleMapLock();
      break;
    case 'open-github':
      await openExternalUrl(REPO_URL);
      break;
    case 'zoom-in':
      zoomBy(1.2);
      break;
    case 'zoom-out':
      zoomBy(1 / 1.2);
      break;
    case 'zoom-reset':
      useViewTransformStore.getState().reset();
      break;
  }
}
