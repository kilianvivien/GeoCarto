import {
  MousePointer2,
  SquareDashed,
  Hand,
  Ruler,
  PenTool,
  Square,
  Circle,
  Hexagon,
  Type,
  PaintBucket,
  MapPin,
  ArrowUpRight,
  Image,
  List,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useNotices } from './notices';
import { useToolStore, type ToolKey } from '@/state/toolStore';
import { useDocumentStore } from '@/state/documentStore';

interface Tool {
  key: ToolKey;
  name: string;
  shortcut: string;
  icon: LucideIcon;
}

/** Tool groups from design.md §4.2. */
const TOOL_GROUPS: Tool[][] = [
  [
    { key: 'move', name: 'Move', shortcut: 'V', icon: MousePointer2 },
    { key: 'marquee', name: 'Marquee', shortcut: 'M', icon: SquareDashed },
    { key: 'pan', name: 'Pan', shortcut: 'H', icon: Hand },
    { key: 'ruler', name: 'Ruler', shortcut: 'K', icon: Ruler },
  ],
  [
    { key: 'pen', name: 'Pen', shortcut: 'P', icon: PenTool },
    { key: 'rectangle', name: 'Rectangle', shortcut: 'R', icon: Square },
    { key: 'ellipse', name: 'Ellipse', shortcut: 'O', icon: Circle },
    { key: 'polygon', name: 'Polygon', shortcut: 'G', icon: Hexagon },
    { key: 'text', name: 'Text', shortcut: 'T', icon: Type },
    { key: 'paint', name: 'Paint area', shortcut: 'B', icon: PaintBucket },
    { key: 'pin', name: 'Pin', shortcut: 'I', icon: MapPin },
    { key: 'arrow', name: 'Arrow', shortcut: 'A', icon: ArrowUpRight },
    { key: 'image', name: 'Image', shortcut: 'J', icon: Image },
  ],
  [
    { key: 'legend', name: 'Legend', shortcut: 'L', icon: List },
    { key: 'comment', name: 'Comment', shortcut: 'C', icon: MessageSquare },
  ],
];

/**
 * Vertical tool rail (design.md §4.2). Active tool is shared by the canvas,
 * inspector, and keyboard shortcuts.
 */
export function ToolRail() {
  const active = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const mode = useDocumentStore((s) => s.project.mode);
  const push = useNotices((s) => s.push);
  const disabled = mode !== 'editing';

  const activate = (tool: Tool) => {
    if (disabled) {
      push('Lock the map area before using annotation tools', 'error');
      return;
    }
    if (active === tool.key) return;
    setActiveTool(tool.key);
    push(`${tool.name} tool selected`);
  };

  return (
    <div
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      className="glass relative z-[5] m-1.5 flex flex-col items-center gap-1 p-2"
    >
      {TOOL_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col items-center gap-1">
          {groupIndex > 0 && <span className="my-1 h-px w-6 bg-[var(--divider)]" />}
          {group.map((tool) => {
            const Icon = tool.icon;
            const isActive = active === tool.key;
            return (
              <button
                key={tool.key}
                type="button"
                data-tool={tool.key}
                aria-label={`${tool.name} (${tool.shortcut})`}
                aria-pressed={isActive}
                disabled={disabled}
                title={`${tool.name} — ${tool.shortcut}`}
                onClick={() => activate(tool)}
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all ${
                  disabled
                    ? 'cursor-not-allowed text-[var(--text-3)] opacity-45'
                    : isActive
                    ? 'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_4px_14px_rgba(0,122,255,0.35)]'
                    : 'text-[var(--text-2)] hover:scale-105 hover:bg-[var(--hover)] active:scale-95'
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
