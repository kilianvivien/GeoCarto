import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { APP_COMMANDS, runAppCommand, type AppCommandDescriptor } from '@/app/appCommands';
import { TOOL_DEFINITIONS } from '@/state/toolStore';
import { useLocale } from '@/i18n/useLocale';
import { useModalFocusTrap } from './useModalFocusTrap';
import type { TranslationKey } from '@/i18n/locales';

const TRANSITION_MS = 220;

function toolCommands(): AppCommandDescriptor[] {
  return TOOL_DEFINITIONS.map((tool) => ({
    command: `tool-${tool.key}`,
    labelKey: `tool.${tool.key}` as TranslationKey,
    groupKey: 'command.groupTools',
    shortcut: tool.shortcut,
  }));
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useLocale((s) => s.t);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(open, dialogRef, onClose);

  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const timeout = window.setTimeout(() => {
      setMounted(false);
      setQuery('');
    }, TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  const commands = useMemo(() => [...APP_COMMANDS, ...toolCommands()], []);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = commands.filter((item) => {
    if (!normalizedQuery) return true;
    const haystack = `${t(item.labelKey)} ${t(item.groupKey)} ${item.shortcut ?? ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  const grouped = filtered.reduce<Record<string, AppCommandDescriptor[]>>((acc, item) => {
    const group = t(item.groupKey);
    acc[group] = [...(acc[group] ?? []), item];
    return acc;
  }, {});

  if (!mounted) return null;

  const run = async (item: AppCommandDescriptor) => {
    onClose();
    if (item.command !== 'open-command-palette') await runAppCommand(item.command);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('command.paletteTitle')}
      className={`fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] px-4 pt-[12vh] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`glass w-[min(620px,100%)] overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-modal)] text-[var(--text)] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:transform-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-1'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--divider)] px-4 py-3">
          <div>
            <div className="text-[14px] font-semibold">{t('command.paletteTitle')}</div>
            <div className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
              {t('command.paletteSubtitle')}
            </div>
          </div>
          <button
            type="button"
            aria-label={t('settings.close')}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-2.5">
          <Search size={15} className="text-[var(--text-3)]" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('command.searchPlaceholder')}
            className="h-8 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-3)]"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {Object.entries(grouped).map(([group, items]) => (
            <section key={group} className="mb-2 last:mb-0">
              <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {group}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const label = t(item.labelKey);
                  return (
                    <button
                      key={item.command}
                      type="button"
                      aria-label={t('command.run', { name: label })}
                      onClick={() => void run(item)}
                      className="flex h-9 items-center justify-between gap-3 rounded-[8px] px-2.5 text-left text-[12.5px] transition-colors hover:bg-[var(--hover)] focus:bg-[var(--hover)] focus:outline-none"
                    >
                      <span className="font-medium text-[var(--text)]">{label}</span>
                      {item.shortcut && (
                        <kbd className="rounded-[5px] border border-[var(--divider)] bg-[var(--glass-thin)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-2)]">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-[12px] text-[var(--text-2)]">
              {t('command.noMatches')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
