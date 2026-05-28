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
  Brush,
  MapPin,
  ArrowUpRight,
  Image,
  List,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';
import { useNotices } from './notices';
import { TOOL_DEFINITIONS, useToolStore, type ToolDefinition } from '@/state/toolStore';
import { useDocumentStore } from '@/state/documentStore';

/** Tool groups from design.md §4.2. */
const ICONS: Record<ToolDefinition['key'], LucideIcon> = {
  move: MousePointer2,
  marquee: SquareDashed,
  pan: Hand,
  ruler: Ruler,
  pen: PenTool,
  rectangle: Square,
  ellipse: Circle,
  polygon: Hexagon,
  text: Type,
  paint: Brush,
  pin: MapPin,
  arrow: ArrowUpRight,
  image: Image,
  legend: List,
  comment: MessageSquare,
};

const TOOL_GROUPS: ToolDefinition[][] = [
  TOOL_DEFINITIONS.slice(0, 4),
  TOOL_DEFINITIONS.slice(4, 13),
  TOOL_DEFINITIONS.slice(13),
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
  const setupDisabled = mode !== 'editing';

  const activate = (tool: ToolDefinition) => {
    if (!tool.enabled) {
      push(tool.disabledReason ?? `${tool.name} is planned for Phase 2`, 'error');
      return;
    }
    if (setupDisabled) {
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
            const Icon = ICONS[tool.key];
            const isActive = active === tool.key;
            const disabled = setupDisabled || !tool.enabled;
            const title = tool.enabled
              ? `${tool.name} — ${tool.shortcut}`
              : `${tool.name} — ${tool.disabledReason ?? 'Phase 2'}`;
            return (
              <button
                key={tool.key}
                type="button"
                data-tool={tool.key}
                aria-label={`${tool.name} (${tool.shortcut})`}
                aria-pressed={isActive}
                disabled={disabled}
                aria-disabled={disabled}
                title={title}
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
                {!tool.enabled && (
                  <span className="sr-only">Phase 2</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
