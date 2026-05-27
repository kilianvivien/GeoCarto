import { useRef, useState } from 'react';
import { MapView } from './MapView';
import { ExportFrame } from './ExportFrame';
import { GeoJsonLayers } from './GeoJsonLayers';
import { AnnotationStage } from './AnnotationStage';
import { StaticBasemapOverlay } from './StaticBasemapOverlay';
import { MapSetupPanel } from './MapSetupPanel';
import { importGeoJsonFiles } from '@/import/importLayers';
import { useDocumentStore } from '@/state/documentStore';

/**
 * The canvas cell: the MapLibre viewport, the headless GeoJSON layer renderer,
 * and an overlay layer above the map (design.md §4.3). Accepts file drops to
 * import GeoJSON.
 */
export function MapCanvas() {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const mode = useDocumentStore((s) => s.project.mode);

  return (
    <div
      data-testid="map-canvas"
      className="relative m-1.5 min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--divider)]"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (mode !== 'editing') return;
        const files = [...e.dataTransfer.files];
        if (files.length) void importGeoJsonFiles(files);
      }}
    >
      <MapView />
      <StaticBasemapOverlay />
      <GeoJsonLayers />
      {mode === 'mapSetup' && <ExportFrame />}
      <AnnotationStage />
      <MapSetupPanel />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[var(--accent-soft)]">
          <div className="glass rounded-[var(--radius-md)] px-4 py-3 text-[13px] font-medium text-[var(--accent)]">
            {mode === 'editing' ? 'Drop GeoJSON to import' : 'Lock the map area before importing GeoJSON'}
          </div>
        </div>
      )}
    </div>
  );
}
