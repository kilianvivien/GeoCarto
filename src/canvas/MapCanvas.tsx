import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { MapView } from './MapView';
import { ExportFrame } from './ExportFrame';
import { GeoJsonLayers } from './GeoJsonLayers';
import { VectorEditor } from './VectorEditor';
import { FeatureContextMenu } from './FeatureContextMenu';
import { EditToolbar } from '@/ui/EditToolbar';
import { DeckOverlay } from './DeckOverlay';
import { AnnotationStage } from './AnnotationStage';
import { StaticBasemapOverlay } from './StaticBasemapOverlay';
import { MapSetupPanel } from './MapSetupPanel';
import { importDataFiles, importGeoJsonFiles, nativePathsToFiles } from '@/import/importLayers';
import type { PageBackground } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';
import { useViewTransformStore } from '@/state/viewTransformStore';
import { useLocale } from '@/i18n/useLocale';
import { isTauri } from '@/app/platform';
import { canvasAnchorFromClientPoint } from './canvasCoordinates';
import { Tooltip } from '@/ui/Tooltip';
import { useNotices } from '@/ui/notices';

type Point = { x: number; y: number };
type SurfaceBox = { x: number; y: number; width: number; height: number };

function ViewZoomControls({ anchor }: { anchor: () => Point }) {
  const zoom = useViewTransformStore((s) => s.zoom);
  const t = useLocale((s) => s.t);
  const { setZoomAt, reset } = useViewTransformStore.getState();

  return (
    <div
      className="glass pointer-events-auto absolute right-3 top-3 z-30 flex items-center gap-1 bg-[var(--glass-strong)] p-1"
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <Tooltip label={t('canvas.zoomOut')} placement="bottom">
        <button
          type="button"
          aria-label={t('canvas.zoomOut')}
          onClick={() => setZoomAt(zoom / 1.2, anchor())}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Minus size={15} />
        </button>
      </Tooltip>
      <span className="mono min-w-12 text-center text-[11px] font-semibold text-[var(--text-2)]">
        {Math.round(zoom * 100)}%
      </span>
      <Tooltip label={t('canvas.zoomIn')} placement="bottom">
        <button
          type="button"
          aria-label={t('canvas.zoomIn')}
          onClick={() => setZoomAt(zoom * 1.2, anchor())}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Plus size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t('canvas.fit')} placement="bottom">
        <button
          type="button"
          aria-label={t('canvas.fit')}
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Maximize2 size={14} />
        </button>
      </Tooltip>
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

const CHECKER_SIZE = 16;
const CHECKER_HALF = CHECKER_SIZE / 2;

/**
 * Surface background for the empty (page-only) basemap. A transparent page is
 * drawn as a checkerboard — the editor-only stand-in image software uses so the
 * canvas stays visible. Export renders true transparency (see export/raster.ts).
 */
function emptyCanvasBackgroundStyle(background: PageBackground | undefined): React.CSSProperties {
  if (background === 'transparent') {
    return {
      backgroundColor: 'var(--checker-light)',
      backgroundImage:
        'linear-gradient(45deg, var(--checker-dark) 25%, transparent 25%),' +
        'linear-gradient(-45deg, var(--checker-dark) 25%, transparent 25%),' +
        'linear-gradient(45deg, transparent 75%, var(--checker-dark) 75%),' +
        'linear-gradient(-45deg, transparent 75%, var(--checker-dark) 75%)',
      backgroundSize: `${CHECKER_SIZE}px ${CHECKER_SIZE}px`,
      backgroundPosition: `0 0, 0 ${CHECKER_HALF}px, ${CHECKER_HALF}px -${CHECKER_HALF}px, -${CHECKER_HALF}px 0`,
    };
  }
  // Always use the same longhand properties so React clears the checkerboard
  // when switching away from transparent (mixing `background` shorthand with the
  // longhands above leaves stale layers behind).
  return {
    backgroundColor: !background || background === 'white' ? '#ffffff' : background,
    backgroundImage: 'none',
    backgroundSize: 'auto',
    backgroundPosition: '0 0',
  };
}

/**
 * The canvas cell: the MapLibre viewport, the headless GeoJSON layer renderer,
 * and an overlay layer above the map (design.md §4.3). Accepts file drops to
 * import GeoJSON.
 */
export function MapCanvas({ chromeSettling }: { chromeSettling: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const panDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const canInspectRef = useRef(false);
  const surfaceRef = useRef<SurfaceBox>({ width: 0, height: 0, x: 0, y: 0 });
  const mode = useDocumentStore((s) => s.project.mode);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);
  const activeTool = useToolStore((s) => s.activeTool);
  const viewZoom = useViewTransformStore((s) => s.zoom);
  const viewPan = useViewTransformStore((s) => s.pan);
  const { panBy, reset } = useViewTransformStore.getState();
  const canvasSize = useElementSize(canvasRef);
  const canInspect = mode === 'editing';
  const canPanView = canInspect && activeTool === 'pan';
  const frameAspect = exportFrame.width / exportFrame.height;
  const surface = useMemo(
    () =>
      mode === 'editing'
        ? containFrame(canvasSize.width, canvasSize.height, frameAspect)
        : { width: canvasSize.width, height: canvasSize.height, x: 0, y: 0 },
    [canvasSize.height, canvasSize.width, frameAspect, mode],
  );

  useEffect(() => {
    if (mode === 'mapSetup') reset();
  }, [mode, reset]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) =>
      getCurrentWindow()
        .onDragDropEvent((event) => {
          if (cancelled) return;
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setDragging(true);
            return;
          }
          if (event.payload.type === 'leave') {
            setDragging(false);
            return;
          }
          setDragging(false);
          if (useDocumentStore.getState().project.mode !== 'editing') return;
          void nativePathsToFiles(event.payload.paths)
            .then(importDataFiles)
            .catch((error) => {
              const message = error instanceof Error ? error.message : 'Import failed.';
              useNotices.getState().push(message, 'error');
            });
        })
        .then((stop) => {
          unlisten = stop;
        }),
    );
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    canInspectRef.current = canInspect;
    surfaceRef.current = surface;
  }, [canInspect, surface]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;

    const anchorFromEvent = (event: Pick<WheelEvent, 'clientX' | 'clientY'>) =>
      canvasAnchorFromClientPoint(
        { x: event.clientX, y: event.clientY },
        node.getBoundingClientRect(),
        surfaceRef.current,
      );

    const onWheel = (event: WheelEvent) => {
      if (!canInspectRef.current) return;
      event.preventDefault();
      const factor = event.ctrlKey ? Math.exp(-event.deltaY * 0.01) : event.deltaY < 0 ? 1.1 : 1 / 1.1;
      useViewTransformStore.getState().zoomBy(factor, anchorFromEvent(event));
    };

    type WebKitGestureEvent = Event & {
      clientX?: number;
      clientY?: number;
      scale?: number;
    };

    let lastGestureScale = 1;
    const onGestureStart = (event: WebKitGestureEvent) => {
      if (!canInspectRef.current) return;
      event.preventDefault();
      lastGestureScale = event.scale ?? 1;
    };
    const onGestureChange = (event: WebKitGestureEvent) => {
      if (!canInspectRef.current) return;
      event.preventDefault();
      const nextScale = event.scale ?? lastGestureScale;
      const factor = nextScale / lastGestureScale;
      lastGestureScale = nextScale;
      const rect = node.getBoundingClientRect();
      useViewTransformStore.getState().zoomBy(
        factor,
        canvasAnchorFromClientPoint(
          {
            x: event.clientX ?? rect.left + node.clientWidth / 2,
            y: event.clientY ?? rect.top + node.clientHeight / 2,
          },
          rect,
          surfaceRef.current,
        ),
      );
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', onGestureStart, { passive: false });
    node.addEventListener('gesturechange', onGestureChange, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGestureStart);
      node.removeEventListener('gesturechange', onGestureChange);
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      data-testid="map-canvas"
      className="relative m-1.5 min-h-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--divider)] bg-[var(--surface)]"
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
        className={`absolute overflow-hidden rounded-[var(--radius-md)] transition-[filter] duration-200 ${
          chromeSettling ? 'blur-[0.35px]' : 'blur-0'
        } ${canPanView ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          left: surface.x,
          top: surface.y,
          width: surface.width,
          height: surface.height,
          ...(basemap.kind === 'empty' ? emptyCanvasBackgroundStyle(exportFrame.background) : null),
          transform: `translate(${viewPan.x}px, ${viewPan.y}px) scale(${viewZoom})`,
          transformOrigin: '0 0',
        }}
      >
        <MapView />
        <StaticBasemapOverlay />
        <GeoJsonLayers />
        <VectorEditor />
        <DeckOverlay />
        {mode === 'mapSetup' && <ExportFrame />}
        <AnnotationStage />
      </div>
      <MapSetupPanel />
      <EditToolbar />
      <FeatureContextMenu />
      {canInspect && (
        <ViewZoomControls
          anchor={() => {
            const rect = canvasRef.current?.getBoundingClientRect();
            return rect
              ? canvasAnchorFromClientPoint(
                  { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
                  rect,
                  surface,
                )
              : { x: 0, y: 0 };
          }}
        />
      )}
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
