import { useEffect, useRef, useState } from 'react';
import { isMacOS, isTauri } from '@/app/platform';
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
import { SettingsDialog } from './SettingsDialog';
import { useUiStore } from './uiStore';
import { useLocale } from '@/i18n/useLocale';
import { usePreferencesStore } from '@/state/preferencesStore';
import { applyAccent } from './accent';

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
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const settingsOpen = useUiStore((s) => s.settingsDialogOpen);
  const closeSettings = useUiStore((s) => s.closeSettingsDialog);
  const accent = usePreferencesStore((s) => s.accent);
  // Reflect the accent preference into the document's CSS custom properties.
  useEffect(() => applyAccent(accent), [accent]);
  const [chromeSettling, setChromeSettling] = useState(false);
  const mounted = useRef(false);
  const rows = showTabs ? '44px 36px minmax(0, 1fr) 28px' : '44px 0px minmax(0, 1fr) 28px';

  useEffect(() => {
    if (!isTauri()) return;
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('set_export_menu_enabled', { enabled: mode === 'editing' }),
    );
  }, [mode]);

  // Push the resolved app locale to the native macOS menu so it rebuilds in the
  // matching language. Keyed on locale alone — rebuilding is expensive, and the
  // effect above already tracks the Export/Share enabled state on mode changes.
  // Rebuilding resets that enabled state, so re-apply it (reading mode at fire
  // time to avoid a needless rebuild whenever mode changes).
  useEffect(() => {
    if (!isTauri()) return;
    void import('@tauri-apps/api/core').then(async ({ invoke }) => {
      await invoke('set_menu_locale', { locale });
      const editing = useDocumentStore.getState().project.mode === 'editing';
      await invoke('set_export_menu_enabled', { enabled: editing });
    });
  }, [locale]);

  // Apply the macOS `sidebar` vibrancy at runtime, after the webview is alive,
  // rather than at native window creation (tauri.conf.json windowEffects): a
  // failed startup-time effect could keep the main window from ever appearing
  // (running-active-NotVisible). Doing it here lets a failure fall back silently
  // to the CSS glass tints instead of hiding the app.
  //
  // The window is created hidden (tauri.conf.json visible:false) and revealed
  // here once the effect has been applied, so it appears as one finished piece —
  // glass + vibrancy + traffic lights together — with no flash of bare native
  // chrome. show() runs unconditionally (outside the effect's try, and on every
  // Tauri platform) so a failed or unsupported effect can never leave the window
  // permanently hidden.
  useEffect(() => {
    if (!isTauri()) return;
    void (async () => {
      try {
        const { getCurrentWindow, Effect, EffectState } = await import('@tauri-apps/api/window');
        const win = getCurrentWindow();
        try {
          if (isMacOS()) {
            await win.setEffects({
              effects: [Effect.Sidebar],
              state: EffectState.FollowsWindowActiveState,
            });
          }
        } catch {
          // Native vibrancy unavailable — keep the existing CSS glass/tint fallback.
        }
        await win.show();
      } catch {
        // Window module/show unavailable — nothing more we can do to reveal it.
      }
    })();
  }, []);

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
      aria-label={t('app.ariaLabel')}
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
      <SettingsDialog open={settingsOpen} onClose={closeSettings} />
      <KeyboardShortcuts />
    </div>
  );
}
