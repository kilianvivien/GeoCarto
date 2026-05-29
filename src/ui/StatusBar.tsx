import { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { BasemapSublayerToggles } from '@/basemap/BasemapSublayerToggles';
import { useViewportStore } from '@/state/viewportStore';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';

/** Approximate map scale denominator (1:N) at the given zoom and latitude. */
function scaleDenominator(zoom: number, latitude: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return Math.round((metersPerPixel * 96) / 0.0254);
}

function BasemapMenu() {
  const basemap = useDocumentStore((s) => s.project.basemap);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  if (basemap.kind !== 'builtin' && basemap.kind !== 'pmtiles-url') return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="basemap-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${
          open ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-2)] hover:bg-[var(--hover)]'
        }`}
      >
        <Layers size={11} />
        Basemap
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Basemap sub-layers"
          className="glass absolute bottom-full left-0 z-50 mb-2 w-56 rounded-[10px] bg-[var(--glass-strong)] p-2.5 text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.24)]"
        >
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Sub-layers
          </div>
          <BasemapSublayerToggles compact />
        </div>
      )}
    </div>
  );
}

/** Bottom status bar (design.md §4.5). Reads the viewport store. */
export function StatusBar() {
  const viewport = useViewportStore((s) => s.viewport);
  const cursor = useViewportStore((s) => s.cursor);
  const gridSnapEnabled = useToolStore((s) => s.gridSnapEnabled);
  const gridSpacing = useToolStore((s) => s.gridSpacing);
  const { setGridSnapEnabled, setGridSpacing } = useToolStore.getState();
  const featureCount = useDocumentStore((s) =>
    s.project.layers.reduce((sum, l) => sum + l.featureCount, 0),
  );

  const [lng, lat] = cursor ?? viewport.center;
  const scale = scaleDenominator(viewport.zoom, viewport.center[1]);

  return (
    <div className="mono flex h-7 items-center justify-between border-t border-[var(--divider)] px-3 text-[10.5px] text-[var(--text-3)]">
      <div className="flex items-center gap-3">
        {/* Save state already lives in the title bar; show the app version here instead. */}
        <span>v{__APP_VERSION__}</span>
        <span>Web Mercator</span>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={gridSnapEnabled}
            onChange={(event) => setGridSnapEnabled(event.target.checked)}
            className="h-3 w-3 accent-[var(--accent)]"
          />
          Grid snap
        </label>
        <input
          aria-label="Grid spacing"
          type="number"
          min={4}
          max={200}
          value={gridSpacing}
          onChange={(event) => setGridSpacing(Number(event.target.value))}
          className="h-5 w-12 rounded-[5px] border border-[var(--divider)] bg-[var(--glass-thin)] px-1 text-[10.5px] text-[var(--text-2)] outline-none"
        />
        <BasemapMenu />
        <span data-testid="feature-count">
          {featureCount.toLocaleString('en-US')} features
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span>
          {lat.toFixed(4)}°, {lng.toFixed(4)}°
        </span>
        <span>1:{scale.toLocaleString('en-US')}</span>
        <span data-testid="zoom-readout">z{viewport.zoom.toFixed(2)}</span>
      </div>
    </div>
  );
}
