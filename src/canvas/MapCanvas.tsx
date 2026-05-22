import { MapView } from './MapView';
import { ExportFrame } from './ExportFrame';

/**
 * The canvas cell: the MapLibre viewport plus an overlay layer above it but
 * inside the canvas border (design.md §4.3). The zoom stack and scale bar will
 * join the overlay in later milestones.
 */
export function MapCanvas() {
  return (
    <div className="relative m-1.5 min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--divider)]">
      <MapView />
      <ExportFrame />
    </div>
  );
}
