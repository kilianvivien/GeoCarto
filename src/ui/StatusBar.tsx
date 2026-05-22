import { useViewportStore } from '@/state/viewportStore';
import { useDocumentStore } from '@/state/documentStore';

/** Approximate map scale denominator (1:N) at the given zoom and latitude. */
function scaleDenominator(zoom: number, latitude: number): number {
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
  return Math.round((metersPerPixel * 96) / 0.0254);
}

/** Bottom status bar (design.md §4.5). Reads the viewport store. */
export function StatusBar() {
  const viewport = useViewportStore((s) => s.viewport);
  const cursor = useViewportStore((s) => s.cursor);
  const featureCount = useDocumentStore((s) =>
    s.project.layers.reduce((sum, l) => sum + l.featureCount, 0),
  );

  const [lng, lat] = cursor ?? viewport.center;
  const scale = scaleDenominator(viewport.zoom, viewport.center[1]);

  return (
    <div className="mono flex h-7 items-center justify-between border-t border-[var(--divider)] px-3 text-[10.5px] text-[var(--text-3)]">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#28c840] shadow-[0_0_4px_#28c840]" />
          Saved
        </span>
        <span>Web Mercator</span>
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
