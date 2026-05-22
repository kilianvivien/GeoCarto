import { Undo2, Redo2, Magnet, Sun, Moon, Share, Download, FileText } from 'lucide-react';
import { useTheme } from './useTheme';

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition-colors ${
        active
          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
          : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
      }`}
    >
      {children}
    </button>
  );
}

/** App title bar — global actions (design.md §4.1). Only theme toggle is wired. */
export function TitleBar() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);

  return (
    <div className="flex h-11 items-center gap-3 border-b border-[var(--divider)] px-3">
      <div className="flex gap-2" aria-hidden>
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="mx-auto flex items-center gap-2 rounded-full px-3 py-1 text-[13px] transition-colors hover:bg-[var(--hover)]">
        <FileText size={14} className="text-[var(--text-3)]" />
        <span className="font-medium text-[var(--text)]">Untitled.cartoproj</span>
        <span className="mono text-[var(--text-3)]">— Edited</span>
      </div>

      <div className="flex items-center gap-1">
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
          className="ml-1 flex h-7 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[12px] font-medium text-[var(--text-on-accent)] transition-[filter] hover:brightness-105"
        >
          <Download size={14} />
          Export
        </button>
      </div>
    </div>
  );
}
