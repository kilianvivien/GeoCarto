import { useEffect } from 'react';
import { useAutosave } from '@/project/autosave';
import { installHistoryCapture } from '@/state/historyStore';
import { useSessionsStore } from '@/state/sessionsStore';
import { TitleBar } from './TitleBar';
import { TabBar } from './TabBar';
import { Workspace } from './Workspace';
import { StatusBar } from './StatusBar';
import { ToastHost } from './ToastHost';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { useDocumentTitle } from './useDocumentTitle';

/**
 * Top-level layout: a rounded glass window with titlebar / workspace / statusbar
 * rows (design.md §4). The macOS system menu bar is intentionally omitted — the
 * web build has no use for it, and the Tauri build will use a native one.
 */
export function AppShell() {
  useAutosave();
  useDocumentTitle();
  useEffect(() => installHistoryCapture(), []);
  // The tab bar collapses out of the chrome when there's a single project, so
  // the grid template has to drop its row too — otherwise the workspace
  // leaves a 36 px dead band at the bottom.
  const showTabs = useSessionsStore((s) => s.sessions.length > 1);
  const rows = showTabs ? '44px 36px 1fr 28px' : '44px 1fr 28px';
  return (
    <div className="h-full p-2">
      <div
        role="application"
        aria-label="GeoCarto"
        className="window-anim glass relative grid h-full overflow-hidden"
        style={{
          gridTemplateRows: rows,
          borderRadius: 'var(--radius-window)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
      >
        <TitleBar />
        {showTabs && <TabBar />}
        <Workspace />
        <StatusBar />
        <ToastHost />
        <KeyboardShortcuts />
      </div>
    </div>
  );
}
