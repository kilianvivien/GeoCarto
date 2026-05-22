import { TitleBar } from './TitleBar';
import { Workspace } from './Workspace';
import { StatusBar } from './StatusBar';
import { ToastHost } from './ToastHost';

/**
 * Top-level layout: a rounded glass window with titlebar / workspace / statusbar
 * rows (design.md §4). The macOS system menu bar is intentionally omitted — the
 * web build has no use for it, and the Tauri build will use a native one.
 */
export function AppShell() {
  return (
    <div className="h-full p-2">
      <div
        role="application"
        aria-label="GeoCarto"
        className="window-anim glass relative grid h-full grid-rows-[44px_1fr_28px] overflow-hidden"
        style={{
          borderRadius: 'var(--radius-window)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        }}
      >
        <TitleBar />
        <Workspace />
        <StatusBar />
        <ToastHost />
      </div>
    </div>
  );
}
