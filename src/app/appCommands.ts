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
import { translate } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';

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
  | 'open-settings'
  | 'open-command-palette'
  | 'open-github'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | `tool-${ToolKey}`;

export interface AppCommandDescriptor {
  command: AppCommand;
  labelKey: TranslationKey;
  groupKey: TranslationKey;
  shortcut?: string;
}

export const APP_COMMANDS: AppCommandDescriptor[] = [
  { command: 'new-project', labelKey: 'title.newProject', groupKey: 'command.groupProject', shortcut: '⌘N' },
  { command: 'open-project', labelKey: 'title.openProject', groupKey: 'command.groupProject', shortcut: '⌘O' },
  { command: 'import-data', labelKey: 'layer.import', groupKey: 'command.groupProject', shortcut: '⌘⇧O' },
  { command: 'save-project', labelKey: 'title.saveProject', groupKey: 'command.groupProject', shortcut: '⌘S' },
  { command: 'save-project-as', labelKey: 'file.saveAs', groupKey: 'command.groupProject', shortcut: '⌘⇧S' },
  { command: 'export', labelKey: 'title.export', groupKey: 'command.groupProject', shortcut: '⌘E' },
  { command: 'share-png', labelKey: 'title.shareMap', groupKey: 'command.groupProject', shortcut: '⌘⇧E' },
  { command: 'close-tab', labelKey: 'tab.closeCurrent', groupKey: 'command.groupProject', shortcut: '⌘W' },
  { command: 'undo', labelKey: 'title.undo', groupKey: 'command.groupEdit', shortcut: '⌘Z' },
  { command: 'redo', labelKey: 'title.redo', groupKey: 'command.groupEdit', shortcut: '⌘⇧Z' },
  { command: 'delete-selection', labelKey: 'annotation.delete', groupKey: 'command.groupEdit', shortcut: 'Delete' },
  { command: 'group-selection', labelKey: 'canvas.group', groupKey: 'command.groupEdit', shortcut: '⌘G' },
  { command: 'ungroup-selection', labelKey: 'canvas.ungroup', groupKey: 'command.groupEdit', shortcut: '⌘⇧G' },
  { command: 'toggle-theme', labelKey: 'settings.theme', groupKey: 'command.groupView' },
  { command: 'toggle-snap', labelKey: 'status.gridSnap', groupKey: 'command.groupView' },
  { command: 'toggle-map-lock', labelKey: 'title.lockMap', groupKey: 'command.groupView' },
  { command: 'zoom-in', labelKey: 'canvas.zoomIn', groupKey: 'command.groupView' },
  { command: 'zoom-out', labelKey: 'canvas.zoomOut', groupKey: 'command.groupView' },
  { command: 'zoom-reset', labelKey: 'canvas.fit', groupKey: 'command.groupView' },
  { command: 'open-settings', labelKey: 'settings.open', groupKey: 'command.groupHelp', shortcut: '⌘,' },
  { command: 'open-command-palette', labelKey: 'command.openPalette', groupKey: 'command.groupHelp', shortcut: '⌘K' },
  { command: 'open-github', labelKey: 'title.github', groupKey: 'command.groupHelp' },
];

async function saveProject(saveAs: boolean): Promise<void> {
  const { project, file, markSaved } = useDocumentStore.getState();
  const push = useNotices.getState().push;
  try {
    const next = saveAs ? await saveProjectAs(project) : await saveProjectToDisk(project, file);
    markSaved(next);
    void rememberRecentProject(next);
    push(translate('toast.savedFile', { name: next.name }));
  } catch (error) {
    if (error instanceof UserCancelledError) return;
    push(error instanceof Error ? error.message : translate('toast.saveFailed'), 'error');
  }
}

async function openProject(): Promise<void> {
  const push = useNotices.getState().push;
  try {
    const { project, file } = await openProjectFromDisk();
    openProjectInNewTab(project, file);
    void rememberRecentProject(file);
    push(translate('toast.openedFile', { name: file.name }));
  } catch (error) {
    if (error instanceof UserCancelledError) return;
    push(error instanceof Error ? error.message : translate('toast.openFailed'), 'error');
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
      push(translate('toast.sharedFile', { name: result.fileName }));
      return;
    }
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.blob })]);
      push(translate('toast.copiedFile', { name: result.fileName }));
      return;
    }

    const { downloadBlob } = await import('@/export/raster');
    const saved = await downloadBlob(result.blob, result.fileName);
    if (saved) push(translate('toast.downloadedFile', { name: result.fileName }));
  } catch (error) {
    if ((error as Error).name === 'AbortError') return;
    push(error instanceof Error ? error.message : translate('toast.shareFailed'), 'error');
  }
}

function closeActiveTab(): void {
  const { activeSessionId, closeSession } = useSessionsStore.getState();
  if (useDocumentStore.getState().dirty) {
    const ok = window.confirm(translate('tab.unsavedConfirm'));
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
      push(translate('command.phase2Planned'), 'error');
      return;
    }
    useToolStore.getState().setActiveTool(tool);
    return;
  }

  switch (command) {
    case 'new-project':
      createNewProject();
      push(translate('toast.createdProject'));
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
      if (!useHistoryStore.getState().undo()) push(translate('command.nothingToUndo'), 'error');
      break;
    case 'redo':
      if (!useHistoryStore.getState().redo()) push(translate('command.nothingToRedo'), 'error');
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
    case 'open-settings':
      useUiStore.getState().openSettingsDialog();
      break;
    case 'open-command-palette':
      useUiStore.getState().openCommandPalette();
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
