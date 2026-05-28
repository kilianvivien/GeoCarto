import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { MapView } from './MapView';
import { ExportFrame } from './ExportFrame';
import { GeoJsonLayers } from './GeoJsonLayers';
import { AnnotationStage } from './AnnotationStage';
import { StaticBasemapOverlay } from './StaticBasemapOverlay';
import { MapSetupPanel } from './MapSetupPanel';
import { importGeoJsonFiles } from '@/import/importLayers';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';
import { useViewTransformStore } from '@/state/viewTransformStore';

function ViewZoomControls() {
  const zoom = useViewTransformStore((s) => s.zoom);
  const { setZoomAt, reset } = useViewTransformStore.getState();
  const anchor = () => {
    const canvas = document.querySelector('[data-testid="map-surface"]');
    const rect = canvas?.getBoundingClientRect();
    return rect ? { x: rect.width / 2, y: rect.height / 2 } : { x: 0, y: 0 };
  };

  return (
    <div className="glass pointer-events-auto absolute right-3 top-3 z-30 flex items-center gap-1 bg-[var(--glass-strong)] p-1">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={() => setZoomAt(zoom / 1.2, anchor())}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        <Minus size={15} />
      </button>
      <span className="mono min-w-12 text-center text-[11px] font-semibold text-[var(--text-2)]">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        onClick={() => setZoomAt(zoom * 1.2, anchor())}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        <Plus size={15} />
      </button>
      <button
        type="button"
        aria-label="Fit canvas"
        title="Fit canvas"
        onClick={reset}
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function containFrame(width: number, height: number, aspect: number) {
  if (width <= 0 || height <= 0 || aspect <= 0) return { width: 0, height: 0, x: 0, y: 0 };
  let surfaceWidth = width;
  let surfaceHeight = surfaceWidth / aspect;
  if (surfaceHeight > height) {
    surfaceHeight = height;
    surfaceWidth = surfaceHeight * aspect;
  }
  return {
    width: surfaceWidth,
    height: surfaceHeight,
    x: (width - surfaceWidth) / 2,
    y: (height - surfaceHeight) / 2,
  };
}

/**
 * The canvas cell: the MapLibre viewport, the headless GeoJSON layer renderer,
 * and an overlay layer above the map (design.md §4.3). Accepts file drops to
 * import GeoJSON.
 */
export function MapCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const mode = useDocumentStore((s) => s.project.mode);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const activeTool = useToolStore((s) => s.activeTool);
  const viewZoom = useViewTransformStore((s) => s.zoom);
  const viewPan = useViewTransformStore((s) => s.pan);
  const { zoomBy, panBy, reset } = useViewTransformStore.getState();
  const canvasSize = useElementSize(canvasRef);
  const canInspect = mode === 'editing';
  const canPanView = canInspect && activeTool === 'pan';
  const frameAspect = exportFrame.width / exportFrame.height;
  const surface =
    mode === 'editing'
      ? containFrame(canvasSize.width, canvasSize.height, frameAspect)
      : { width: canvasSize.width, height: canvasSize.height, x: 0, y: 0 };

  useEffect(() => {
    if (mode === 'mapSetup') reset();
  }, [mode, reset]);

  return (
    <div
      ref={canvasRef}
      data-testid="map-canvas"
      className="relative m-1.5 min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--divider)] bg-[var(--surface)]"
      onWheel={(e) => {
        if (!canInspect) return;
        e.preventDefault();
        const rect = e.currentTarget.querySelector('[data-testid="map-surface"]')?.getBoundingClientRect();
        zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, {
          x: rect ? e.clientX - rect.left : 0,
          y: rect ? e.clientY - rect.top : 0,
        });
      }}
      onPointerDown={(e) => {
        if (!canPanView || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        panDragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const drag = panDragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        panBy({ x: e.clientX - drag.x, y: e.clientY - drag.y });
        panDragRef.current = { ...drag, x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (panDragRef.current?.pointerId !== e.pointerId) return;
        panDragRef.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        panDragRef.current = null;
      }}
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
      <div
        data-testid="map-surface"
        className={`absolute overflow-hidden rounded-[var(--radius-md)] ${canPanView ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          left: surface.x,
          top: surface.y,
          width: surface.width,
          height: surface.height,
          transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewZoom})`,
          transformOrigin: '0 0',
        }}
      >
        <MapView />
        <StaticBasemapOverlay />
        <GeoJsonLayers />
        {mode === 'mapSetup' && <ExportFrame />}
        <AnnotationStage />
      </div>
      <MapSetupPanel />
      {canInspect && <ViewZoomControls />}
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
