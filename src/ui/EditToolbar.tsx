import { MousePointer2, MapPin, Spline, Hexagon, Check, type LucideIcon } from 'lucide-react';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore, type EditTool } from '@/state/editStore';

const EDIT_TOOLS: { tool: EditTool; label: string; hint: string; icon: LucideIcon }[] = [
  {
    tool: 'select',
    label: 'Select & edit',
    hint: 'Click a shape to select it, then drag its points to reshape, or drag the middle dots to add points',
    icon: MousePointer2,
  },
  { tool: 'point', label: 'Draw point', hint: 'Click on the map to drop a point', icon: MapPin },
  {
    tool: 'line',
    label: 'Draw line',
    hint: 'Click to add each point along the line; double-click to finish',
    icon: Spline,
  },
  {
    tool: 'polygon',
    label: 'Draw polygon',
    hint: 'Click each corner; double-click (or click the first point) to close the shape',
    icon: Hexagon,
  },
];

/**
 * Floating sub-tool bar shown while a layer is open in the vector editor. Lets the
 * user switch between select/draw modes and finish editing. Visible only in edit
 * mode; the normal annotation tool rail keeps working for everything else.
 */
export function EditToolbar() {
  const editingLayerId = useEditStore((s) => s.editingLayerId);
  const activeTool = useEditStore((s) => s.activeTool);
  const layerName = useDocumentStore((s) =>
    s.project.layers.find((l) => l.id === editingLayerId)?.name,
  );

  if (!editingLayerId) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
      <div
        role="toolbar"
        aria-label="Vector editing tools"
        className="glass pointer-events-auto flex items-center gap-1 bg-[var(--glass-strong)] p-1 shadow-[0_12px_36px_rgba(0,0,0,0.24)]"
      >
        <span className="max-w-[160px] truncate px-2 text-[11.5px] font-medium text-[var(--text-2)]">
          {layerName ?? 'Editing'}
        </span>
        <span className="mx-0.5 h-5 w-px bg-[var(--divider)]" />
        {EDIT_TOOLS.map(({ tool, label, hint, icon: Icon }) => {
          const isActive = activeTool === tool;
          return (
            <button
              key={tool}
              type="button"
              data-edit-tool={tool}
              aria-label={`${label}. ${hint}`}
              aria-pressed={isActive}
              title={`${label} — ${hint}`}
              onClick={() => useEditStore.getState().setTool(tool)}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_4px_14px_rgba(0,122,255,0.35)]'
                  : 'text-[var(--text-2)] hover:bg-[var(--hover)] active:scale-95'
              }`}
            >
              <Icon size={16} />
            </button>
          );
        })}
        <span className="mx-0.5 h-5 w-px bg-[var(--divider)]" />
        <button
          type="button"
          data-edit-tool="done"
          title="Finish editing this layer"
          onClick={() => useEditStore.getState().exitEdit()}
          className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[11.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Check size={15} />
          Done
        </button>
      </div>
    </div>
  );
}
