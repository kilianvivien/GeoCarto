import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearAutosave, flushActiveAutosave } from '@/project/autosave';
import { activeSessionId } from '@/state/sessionsStore';
import { translate } from '@/i18n/useLocale';

/** How recent a prior crash must be to count as a crash *loop* (ms). */
const LOOP_WINDOW_MS = 12_000;
/** After this long without a crash, the boundary clears the loop counter. */
const STABLE_RESET_MS = 15_000;
const CRASH_KEY = 'geocarto-crash';

type SaveState = 'saving' | 'saved' | 'failed';

interface CrashRecord {
  count: number;
  at: number;
}

function readCrashRecord(): CrashRecord {
  try {
    const raw = sessionStorage.getItem(CRASH_KEY);
    if (!raw) return { count: 0, at: 0 };
    const parsed = JSON.parse(raw) as CrashRecord;
    if (typeof parsed.count === 'number' && typeof parsed.at === 'number') return parsed;
  } catch {
    /* ignore malformed / unavailable storage */
  }
  return { count: 0, at: 0 };
}

function writeCrashRecord(record: CrashRecord): void {
  try {
    sessionStorage.setItem(CRASH_KEY, JSON.stringify(record));
  } catch {
    /* sandboxed browsers throw — the loop guard simply degrades to off */
  }
}

function clearCrashRecord(): void {
  try {
    sessionStorage.removeItem(CRASH_KEY);
  } catch {
    /* ignore */
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  /** True when this crash followed a recent one — restoring the same session re-crashed. */
  isLoop: boolean;
  saveState: SaveState;
  message: string;
  stack: string;
}

const INITIAL_STATE: ErrorBoundaryState = {
  hasError: false,
  isLoop: false,
  saveState: 'saving',
  message: '',
  stack: '',
};

/**
 * Top-level boundary (M25). A render error anywhere below crashes only into this
 * fallback instead of a blank page; the active session is force-flushed to the
 * autosave draft so a reload can recover it. A short-window crash counter detects
 * the poison-document case — where recovery restores the very state that crashed —
 * and offers to discard that session instead of looping forever.
 *
 * Caveat (matches plan.md wording): error boundaries catch render/lifecycle errors,
 * not errors thrown in event handlers, timers, or rejected promises.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = INITIAL_STATE;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      saveState: 'saving',
      message: error.message || String(error),
      stack: error.stack ?? '',
    };
  }

  componentDidMount(): void {
    // Survived long enough without crashing → forget any earlier crash so the
    // next unrelated error is treated as a first occurrence, not a loop.
    this.stableTimer = setTimeout(clearCrashRecord, STABLE_RESET_MS);
  }

  componentWillUnmount(): void {
    if (this.stableTimer) clearTimeout(this.stableTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }

    const previous = readCrashRecord();
    const now = Date.now();
    const withinWindow = previous.at !== 0 && now - previous.at < LOOP_WINDOW_MS;
    const count = withinWindow ? previous.count + 1 : 1;
    writeCrashRecord({ count, at: now });
    this.setState({ isLoop: count >= 2 });

    console.error('GeoCarto render crash:', error, info.componentStack);

    // Persist in-flight work, then unblock the reload button only once the draft
    // is durable. Gating the reload on this promise avoids interrupting the
    // IndexedDB write mid-flight.
    flushActiveAutosave()
      .then(() => this.setState({ saveState: 'saved' }))
      .catch(() => this.setState({ saveState: 'failed' }));
  }

  private reload = (): void => {
    window.location.reload();
  };

  private discardAndReload = (): void => {
    void clearAutosave(activeSessionId()).finally(() => {
      clearCrashRecord();
      window.location.reload();
    });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const t = translate;
    const { isLoop, saveState, message, stack } = this.state;
    const details = [message, stack].filter(Boolean).join('\n\n');

    return (
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={t('crash.title')}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--scrim)] p-6"
      >
        <div className="glass w-[440px] max-w-full rounded-[var(--radius-md)] bg-[var(--surface-modal)] p-6 text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="text-[15px] font-semibold">
            {isLoop ? t('crash.loopTitle') : t('crash.title')}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {isLoop ? t('crash.loopBody') : t('crash.body')}
          </p>

          <div className="mt-3 text-[11.5px] text-[var(--text-3)]">
            {saveState === 'saving' && t('crash.saving')}
            {saveState === 'saved' && t('crash.saved')}
            {saveState === 'failed' && t('crash.saveFailed')}
          </div>

          {details && (
            <details className="mt-3 text-[11px] text-[var(--text-3)]">
              <summary className="cursor-pointer select-none text-[var(--text-2)]">
                {t('crash.details')}
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[8px] border border-[var(--divider)] bg-[var(--glass-thin)] p-2 font-mono text-[10.5px] leading-snug">
                {details}
              </pre>
            </details>
          )}

          <div className="mt-5 flex justify-end gap-2">
            {isLoop && (
              <button
                type="button"
                onClick={this.discardAndReload}
                className="flex h-8 items-center rounded-[8px] px-3 text-[12px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                {t('crash.discardReload')}
              </button>
            )}
            <button
              type="button"
              onClick={this.reload}
              disabled={saveState === 'saving'}
              className="flex h-8 items-center rounded-[8px] bg-[var(--accent)] px-3.5 text-[12px] font-medium text-[var(--text-on-accent)] shadow-[0_4px_14px_rgba(0,122,255,0.35)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('crash.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
