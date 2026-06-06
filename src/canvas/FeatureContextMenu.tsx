import { useEffect } from 'react';
import { PenLine, Download } from 'lucide-react';
import { useEditStore } from '@/state/editStore';
import { useDocumentStore } from '@/state/documentStore';
import { useNotices } from '@/ui/notices';
import { useLocale } from '@/i18n/useLocale';
import { exportLayerGeoJson } from '@/export/geojson';
import { useFeatureMenuStore } from './featureMenuStore';

/**
 * Right-click menu for a GeoJSON feature on the map. Currently a single fast path:
 * jump straight into vector edit mode for the feature's layer. Positioned `fixed`
 * at the cursor so the map's pan/zoom transform doesn't shift it.
 */
export function FeatureContextMenu() {
  const menu = useFeatureMenuStore((s) => s.menu);
  const t = useLocale((s) => s.t);

  useEffect(() => {
    if (!menu) return;
    const close = () => useFeatureMenuStore.getState().close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  if (!menu) return null;

  const exportLayer = () => {
    const layer = useDocumentStore.getState().project.layers.find((l) => l.id === menu.layerId);
    useFeatureMenuStore.getState().close();
    if (!layer) return;
    if (layer.data.features.length === 0) {
      useNotices.getState().push(t('layer.exportEmpty'), 'error');
      return;
    }
    void exportLayerGeoJson(layer)
      .then((saved) => {
        if (saved) useNotices.getState().push(t('layer.exported', { name: layer.name }));
      })
      .catch(() => useNotices.getState().push(t('layer.exportFailed'), 'error'));
  };

  return (
    <div
      role="menu"
      aria-label={t('feature.menu')}
      // Stop the global pointerdown-to-close from firing before the item's click.
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 min-w-48 rounded-[10px] border border-[var(--divider)] bg-[var(--glass-strong)] p-1 text-[12px] text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="truncate px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-3)]">
        {menu.layerName}
      </div>
      <button
        type="button"
        role="menuitem"
        disabled={menu.locked}
        onClick={() => {
          useEditStore.getState().enterEdit(menu.layerId);
          useFeatureMenuStore.getState().close();
        }}
        className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:text-[var(--text-3)] enabled:hover:bg-[var(--hover)]"
      >
        <PenLine size={14} className="text-[var(--text-2)]" />
        {menu.locked ? t('feature.layerLocked') : t('layer.editFeatures')}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={exportLayer}
        className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left hover:bg-[var(--hover)]"
      >
        <Download size={14} className="text-[var(--text-2)]" />
        {t('layer.export')}
      </button>
    </div>
  );
}
