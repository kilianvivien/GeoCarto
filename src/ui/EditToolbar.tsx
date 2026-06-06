import { useEffect, useState } from 'react';
import {
  MousePointer2,
  MapPin,
  Spline,
  Hexagon,
  Square,
  Circle,
  Trash2,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore, type EditTool } from '@/state/editStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { useLocale } from '@/i18n/useLocale';
import type { TranslationKey } from '@/i18n/locales';

const EDIT_TOOLS: { tool: EditTool; labelKey: TranslationKey; hintKey: TranslationKey; icon: LucideIcon }[] = [
  {
    tool: 'select',
    labelKey: 'edit.select',
    hintKey: 'edit.selectHint',
    icon: MousePointer2,
  },
  { tool: 'point', labelKey: 'edit.point', hintKey: 'edit.pointHint', icon: MapPin },
  {
    tool: 'line',
    labelKey: 'edit.line',
    hintKey: 'edit.lineHint',
    icon: Spline,
  },
  {
    tool: 'polygon',
    labelKey: 'edit.polygon',
    hintKey: 'edit.polygonHint',
    icon: Hexagon,
  },
  {
    tool: 'rectangle',
    labelKey: 'edit.rectangle',
    hintKey: 'edit.rectangleHint',
    icon: Square,
  },
  {
    tool: 'circle',
    labelKey: 'edit.circle',
    hintKey: 'edit.circleHint',
    icon: Circle,
  },
];

/**
 * Floating sub-tool bar shown while a layer is open in the vector editor. Lets the
 * user switch between select/draw modes and finish editing. Visible only in edit
 * mode; the normal annotation tool rail keeps working for everything else.
 */
export function EditToolbar() {
  const t = useLocale((s) => s.t);
  const editingLayerId = useEditStore((s) => s.editingLayerId);
  const activeTool = useEditStore((s) => s.activeTool);
  const selectedFeatureId = useEditStore((s) => s.selectedFeatureId);
  const layerName = useDocumentStore((s) =>
    s.project.layers.find((l) => l.id === editingLayerId)?.name,
  );
  const [mounted, setMounted] = useState(Boolean(editingLayerId));
  const [visible, setVisible] = useState(Boolean(editingLayerId));
  const [lastLayerName, setLastLayerName] = useState<string | null>(layerName ?? null);

  useEffect(() => {
    if (layerName) setLastLayerName(layerName);
  }, [layerName]);

  useEffect(() => {
    if (editingLayerId) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(timer);
  }, [editingLayerId]);

  if (!mounted) return null;

  const deleteSelected = () => {
    const { editingLayerId: layerId, selectedFeatureId: featureId } = useEditStore.getState();
    if (!layerId || featureId == null) return;
    hintHistoryLabel('Delete feature');
    useDocumentStore.getState().removeFeature(layerId, featureId);
    useEditStore.getState().selectFeature(null);
  };

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <div
        role="toolbar"
        aria-label={t('edit.toolbar')}
        className={`glass flex items-center gap-1 bg-[var(--glass-strong)] p-1 shadow-[0_12px_36px_rgba(0,0,0,0.24)] transition-transform duration-150 ease-out motion-reduce:transition-none ${
          visible ? 'pointer-events-auto scale-100' : 'pointer-events-none scale-[0.98]'
        }`}
      >
        <span className="max-w-[160px] truncate px-2 text-[11.5px] font-medium text-[var(--text-2)]">
          {layerName ?? lastLayerName ?? t('edit.editing')}
        </span>
        <span className="mx-0.5 h-5 w-px bg-[var(--divider)]" />
        {EDIT_TOOLS.map(({ tool, labelKey, hintKey, icon: Icon }) => {
          const isActive = activeTool === tool;
          const label = t(labelKey);
          const hint = t(hintKey);
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
          data-edit-tool="delete"
          aria-label={`${t('edit.delete')}. ${t('edit.deleteHint')}`}
          title={`${t('edit.delete')} — ${t('edit.deleteHint')}`}
          disabled={selectedFeatureId == null}
          onClick={deleteSelected}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--danger,#ff5f57)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Trash2 size={15} />
        </button>
        <span className="mx-0.5 h-5 w-px bg-[var(--divider)]" />
        <button
          type="button"
          data-edit-tool="done"
          title={t('edit.doneTitle')}
          onClick={() => useEditStore.getState().exitEdit()}
          className="flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[11.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Check size={15} />
          {t('edit.done')}
        </button>
      </div>
    </div>
  );
}
