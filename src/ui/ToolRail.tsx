import { useState } from 'react';
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

interface Tool {
  key: string;
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
 * Vertical tool rail (design.md §4.2). Tools are inert this pass — selecting one
 * only updates local active state; annotation behaviour lands in Milestone 4.
 */
export function ToolRail() {
  const [active, setActive] = useState('move');

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
                title={`${tool.name} — ${tool.shortcut}`}
                onClick={() => setActive(tool.key)}
                className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all ${
                  isActive
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
