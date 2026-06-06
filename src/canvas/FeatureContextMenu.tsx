import { useEffect } from 'react';
import { PenLine } from 'lucide-react';
import { useEditStore } from '@/state/editStore';
import { useFeatureMenuStore } from './featureMenuStore';

/**
 * Right-click menu for a GeoJSON feature on the map. Currently a single fast path:
 * jump straight into vector edit mode for the feature's layer. Positioned `fixed`
 * at the cursor so the map's pan/zoom transform doesn't shift it.
 */
export function FeatureContextMenu() {
  const menu = useFeatureMenuStore((s) => s.menu);

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

  return (
    <div
      role="menu"
      aria-label="Feature menu"
      // Stop the global pointerdown-to-close from firing before the item's click.
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 min-w-44 rounded-[10px] border border-[var(--divider)] bg-[var(--glass-strong)] p-1 text-[12px] text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl"
      style={{ left: menu.x, top: menu.y }}
    >
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
        {menu.locked ? 'Layer is locked' : 'Edit features'}
      </button>
    </div>
  );
}
