import { useEffect, useRef, useState } from 'react';
import { isTauri } from '@/app/platform';
import { useAutosave } from '@/project/autosave';
import { installHistoryCapture } from '@/state/historyStore';
import { useDocumentStore } from '@/state/documentStore';
import { useSessionsStore } from '@/state/sessionsStore';
import { TitleBar } from './TitleBar';
import { TabBar } from './TabBar';
import { Workspace } from './Workspace';
import { StatusBar } from './StatusBar';
import { ToastHost } from './ToastHost';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { useDocumentTitle } from './useDocumentTitle';

/**
 * Top-level layout: a full-bleed glass window with titlebar / workspace /
 * statusbar rows (design.md §4). The chrome fills the viewport edge-to-edge so
 * the web build and the Tauri shell read as a single native window — on desktop
 * the OS draws the rounded corners and the traffic lights (Overlay title bar),
 * and the window's native vibrancy shows through the translucent glass. The
 * macOS system menu bar lives in the Tauri shell; the web chrome stays focused
 * on in-canvas project controls.
 */
export function AppShell() {
  useAutosave();
  useDocumentTitle();
  useEffect(() => installHistoryCapture(), []);
  const showTabs = useSessionsStore((s) => s.sessions.length > 1);
  const mode = useDocumentStore((s) => s.project.mode);
  const [chromeSettling, setChromeSettling] = useState(false);
  const mounted = useRef(false);
  const rows = showTabs ? '44px 36px minmax(0, 1fr) 28px' : '44px 0px minmax(0, 1fr) 28px';

  useEffect(() => {
    if (!isTauri()) return;
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('set_export_menu_enabled', { enabled: mode === 'editing' }),
    );
  }, [mode]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setChromeSettling(true);
    const timeout = window.setTimeout(() => setChromeSettling(false), 220);
    return () => window.clearTimeout(timeout);
  }, [showTabs]);

  return (
    <div
      role="application"
      aria-label="GeoCarto"
      className="window-anim glass relative grid h-full overflow-hidden transition-[grid-template-rows] duration-200 ease-out"
      style={{
        gridTemplateRows: rows,
        borderRadius: 0,
        border: 'none',
        boxShadow: 'none',
      }}
    >
      <TitleBar />
      <TabBar visible={showTabs} />
      <Workspace chromeSettling={chromeSettling} />
      <StatusBar />
      <ToastHost />
      <KeyboardShortcuts />
    </div>
  );
}
