import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { dispatchCanvasGestureStart, TouchGestureTracker } from './touchGestures';
import { Tooltip } from '@/ui/Tooltip';
import { useNotices } from '@/ui/notices';

type Point = { x: number; y: number };
type SurfaceBox = { x: number; y: number; width: number; height: number };

// Lazy: pulls in d3-geo/d3-geo-projection/world-atlas, which should never be
// part of the app-shell chunk — only projected-engine documents pay this cost.
const ProjectedMapView = lazy(() => import('./ProjectedMapView').then((m) => ({ default: m.ProjectedMapView })));

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
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] pointer-coarse:h-11 pointer-coarse:w-11"
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
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <Plus size={15} />
        </button>
      </Tooltip>
      <Tooltip label={t('canvas.fit')} placement="bottom">
        <button
          type="button"
          aria-label={t('canvas.fit')}
          onClick={reset}
          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--text-2)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] pointer-coarse:h-11 pointer-coarse:w-11"
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
  const engine = useDocumentStore((s) => s.project.engine);
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

    const anchorFromEvent = (clientPoint: Point) =>
      canvasAnchorFromClientPoint(clientPoint, node.getBoundingClientRect(), surfaceRef.current);

    const onWheel = (event: WheelEvent) => {
      if (!canInspectRef.current) return;
      event.preventDefault();
      const factor = event.ctrlKey ? Math.exp(-event.deltaY * 0.01) : event.deltaY < 0 ? 1.1 : 1 / 1.1;
      useViewTransformStore.getState().zoomBy(factor, anchorFromEvent({ x: event.clientX, y: event.clientY }));
    };

    type WebKitGestureEvent = Event & {
      clientX?: number;
      clientY?: number;
      scale?: number;
    };

    // Two-finger touch navigation (iPad): pan and pinch-zoom the workspace no
    // matter which tool is active, so one finger/pencil keeps drawing while
    // two fingers navigate — the split every tablet drawing app uses. Runs in
    // the capture phase so gesture touches are swallowed before Konva or the
    // annotation tools can misread them as taps, drags, or strokes.
    const touchTracker = new TouchGestureTracker();
    // Palm rejection: while an Apple Pencil is on the glass, finger/palm
    // touches are swallowed outright — they must neither navigate nor reach
    // the tools. (Pen pointers themselves always pass through untouched.)
    const activePenPointers = new Set<number>();
    // Touches swallowed for palm rejection, so their move/up events are
    // swallowed consistently even after the pen lifts mid-contact.
    const rejectedTouches = new Set<number>();

    const onTouchPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'pen') {
        activePenPointers.add(event.pointerId);
        return;
      }
      if (event.pointerType !== 'touch' || !canInspectRef.current) return;
      if (activePenPointers.size > 0) {
        rejectedTouches.add(event.pointerId);
        event.stopPropagation();
        return;
      }
      const verdict = touchTracker.down(event.pointerId, { x: event.clientX, y: event.clientY });
      if (verdict === 'passthrough') return;
      if (verdict === 'gesture-start') dispatchCanvasGestureStart();
      event.stopPropagation();
    };
    const onTouchPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (rejectedTouches.has(event.pointerId)) {
        event.stopPropagation();
        return;
      }
      const result = touchTracker.move(event.pointerId, { x: event.clientX, y: event.clientY });
      if (result === 'passthrough') return;
      event.stopPropagation();
      if (result === 'swallow') return;
      const { panBy: panView, zoomBy } = useViewTransformStore.getState();
      panView(result.panDelta);
      if (result.zoomFactor !== 1) zoomBy(result.zoomFactor, anchorFromEvent(result.centroid));
    };
    const onTouchPointerUp = (event: PointerEvent) => {
      if (event.pointerType === 'pen') {
        activePenPointers.delete(event.pointerId);
        return;
      }
      if (event.pointerType !== 'touch') return;
      if (rejectedTouches.delete(event.pointerId)) {
        event.stopPropagation();
        return;
      }
      if (touchTracker.up(event.pointerId) === 'swallow') event.stopPropagation();
    };
    // Konva also listens to the parallel touch* compatibility events, so while
    // a gesture (or palm rejection) owns the fingers those must be swallowed too.
    const onNativeTouch = (event: TouchEvent) => {
      if (touchTracker.active || rejectedTouches.size > 0) event.stopPropagation();
    };
    // Bubble-phase safety net: pointers that lift outside the canvas (their up
    // never passes through the node's capture handlers) must not leave stale
    // pen/gesture state behind. Swallowed events never get here — they were
    // already cleaned up where they were swallowed.
    const onWindowPointerEnd = (event: PointerEvent) => {
      if (event.pointerType === 'pen') activePenPointers.delete(event.pointerId);
      if (event.pointerType === 'touch') {
        rejectedTouches.delete(event.pointerId);
        touchTracker.up(event.pointerId);
      }
    };

    let lastGestureScale = 1;
    const onGestureStart = (event: WebKitGestureEvent) => {
      if (!canInspectRef.current || touchTracker.active) return;
      event.preventDefault();
      lastGestureScale = event.scale ?? 1;
    };
    const onGestureChange = (event: WebKitGestureEvent) => {
      // Touch pinches are handled by the pointer-based tracker above — these
      // WebKit gesture events only serve macOS trackpads.
      if (!canInspectRef.current || touchTracker.active) return;
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
    node.addEventListener('pointerdown', onTouchPointerDown, { capture: true });
    node.addEventListener('pointermove', onTouchPointerMove, { capture: true });
    node.addEventListener('pointerup', onTouchPointerUp, { capture: true });
    node.addEventListener('pointercancel', onTouchPointerUp, { capture: true });
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
      node.addEventListener(type, onNativeTouch, { capture: true });
    }
    window.addEventListener('pointerup', onWindowPointerEnd);
    window.addEventListener('pointercancel', onWindowPointerEnd);
    return () => {
      window.removeEventListener('pointerup', onWindowPointerEnd);
      window.removeEventListener('pointercancel', onWindowPointerEnd);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGestureStart);
      node.removeEventListener('gesturechange', onGestureChange);
      node.removeEventListener('pointerdown', onTouchPointerDown, { capture: true });
      node.removeEventListener('pointermove', onTouchPointerMove, { capture: true });
      node.removeEventListener('pointerup', onTouchPointerUp, { capture: true });
      node.removeEventListener('pointercancel', onTouchPointerUp, { capture: true });
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
        node.removeEventListener(type, onNativeTouch, { capture: true });
      }
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
        // touch-none: the surface owns every touch itself (tools, two-finger
        // navigation, MapLibre) — without it Safari cancels pointer streams to
        // run its own pan/zoom and drawing breaks mid-stroke on iPad.
        className={`touch-none absolute overflow-hidden rounded-[var(--radius-md)] transition-[filter] duration-200 ${
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
        {engine === 'projected' ? (
          <Suspense fallback={null}>
            <ProjectedMapView />
          </Suspense>
        ) : (
          <>
            <MapView />
            <StaticBasemapOverlay />
            <GeoJsonLayers />
            <VectorEditor />
            <DeckOverlay />
          </>
        )}
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
