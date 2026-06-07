import { useEffect, useRef, useState } from 'react';
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
  LayoutTemplate,
  Heading,
  Copyright,
  Compass,
  Scaling,
  type LucideIcon,
} from 'lucide-react';
import { useNotices } from './notices';
import { TOOL_DEFINITIONS, useToolStore, type ToolDefinition } from '@/state/toolStore';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { insertFurniture, type FurnitureKind } from '@/tools/insertFurniture';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';
import { Tooltip } from './Tooltip';

const FURNITURE_ITEMS: { kind: FurnitureKind; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { kind: 'titleblock', labelKey: 'furniture.titleblock', icon: Heading },
  { kind: 'sourcecredit', labelKey: 'furniture.sourcecredit', icon: Copyright },
  { kind: 'scalebar', labelKey: 'furniture.scalebar', icon: Scaling },
  { kind: 'northarrow', labelKey: 'furniture.northarrow', icon: Compass },
];

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
  const t = useLocale((s) => s.t);
  const active = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const mode = useDocumentStore((s) => s.project.mode);
  const editingVectors = useEditStore((s) => s.editingLayerId !== null);
  const push = useNotices((s) => s.push);
  // Annotation tools are unavailable while the vector editor owns the map — the
  // two modes are mutually exclusive, and the rail dims to make that obvious.
  const setupDisabled = mode !== 'editing' || editingVectors;
  const [insertOpen, setInsertOpen] = useState(false);
  const insertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!insertOpen) return;
    const close = (e: Event) => {
      if (!insertRef.current?.contains(e.target as Node)) setInsertOpen(false);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [insertOpen]);

  const activate = (tool: ToolDefinition) => {
    if (!tool.enabled) {
      push(tool.disabledReason ?? t('tools.planned', { name: t(`tool.${tool.key}`) }), 'error');
      return;
    }
    if (editingVectors) {
      push(t('tools.finishLayer'), 'error');
      return;
    }
    if (setupDisabled) {
      push(t('tools.lockMapFirst'), 'error');
      return;
    }
    if (active === tool.key) return;
    setActiveTool(tool.key);
    push(t('tools.selected', { name: t(`tool.${tool.key}`) }));
  };

  return (
    <div
      role="toolbar"
      aria-label={t('tools.toolbar')}
      aria-orientation="vertical"
      aria-disabled={editingVectors}
      title={editingVectors ? t('tools.editingLayerHint') : undefined}
      className={`glass relative z-[5] m-1.5 flex flex-col items-center gap-1 p-2 transition-opacity ${
        editingVectors ? 'opacity-40' : ''
      }`}
    >
      {TOOL_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col items-center gap-1">
          {groupIndex > 0 && <span className="my-1 h-px w-6 bg-[var(--divider)]" />}
          {group.map((tool) => {
            const Icon = ICONS[tool.key];
            const name = t(`tool.${tool.key}`);
            const isActive = active === tool.key;
            const disabled = setupDisabled || !tool.enabled;
            // Tooltip text mirrors the old `title=` affordances: a planned tool
            // explains the Phase-2 gate, a setup-locked tool says to lock the map
            // first, an available tool shows its one-line description + shortcut.
            const description = !tool.enabled
              ? (tool.disabledReason ?? t('tools.phase2'))
              : setupDisabled
                ? t('tools.lockMapFirst')
                : t(`tool.${tool.key}.desc` as TranslationKey);
            return (
              <Tooltip
                key={tool.key}
                label={name}
                description={description}
                shortcut={tool.enabled && !setupDisabled ? tool.shortcut : undefined}
                placement="right"
              >
                <button
                  type="button"
                  data-tool={tool.key}
                  aria-label={`${name} (${tool.shortcut})`}
                  aria-pressed={isActive}
                  disabled={disabled}
                  aria-disabled={disabled}
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
                  {!tool.enabled && <span className="sr-only">{t('tools.phase2')}</span>}
                </button>
              </Tooltip>
            );
          })}
        </div>
      ))}

      <span className="my-1 h-px w-6 bg-[var(--divider)]" />
      <div ref={insertRef} className="relative flex flex-col items-center">
        <Tooltip
          label={t('tools.insertFurniture')}
          description={
            editingVectors
              ? t('tools.finishLayerFurniture')
              : setupDisabled
                ? t('tools.lockMapFurniture')
                : t('tooltip.insertFurniture.desc')
          }
          placement="right"
        >
        <button
          type="button"
          aria-label={t('tools.insertFurniture')}
          aria-haspopup="menu"
          aria-expanded={insertOpen}
          disabled={setupDisabled}
          onClick={() => {
            if (editingVectors) {
              push(t('tools.finishLayerFurniture'), 'error');
              return;
            }
            if (setupDisabled) {
              push(t('tools.lockMapFurniture'), 'error');
              return;
            }
            setInsertOpen((prev) => !prev);
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition-all ${
            setupDisabled
              ? 'cursor-not-allowed text-[var(--text-3)] opacity-45'
              : insertOpen
              ? 'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_4px_14px_rgba(0,122,255,0.35)]'
              : 'text-[var(--text-2)] hover:scale-105 hover:bg-[var(--hover)] active:scale-95'
          }`}
        >
          <LayoutTemplate size={18} />
        </button>
        </Tooltip>
        {insertOpen && (
          <div
            role="menu"
            aria-label={t('tools.insertFurniture')}
            className="absolute left-[calc(100%+8px)] top-0 z-40 flex w-44 flex-col gap-px rounded-[10px] border border-[var(--divider)] bg-[var(--glass-strong)] p-1 text-[12px] text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          >
            {FURNITURE_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const label = t(item.labelKey);
              return (
                <button
                  key={item.kind}
                  type="button"
                  role="menuitem"
                  data-furniture={item.kind}
                  onClick={() => {
                    insertFurniture(item.kind);
                    setInsertOpen(false);
                    push(t('tools.furnitureInserted', { name: label }));
                  }}
                  className="flex items-center gap-2 rounded-[7px] px-2 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
                >
                  <ItemIcon size={14} className="text-[var(--text-2)]" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
