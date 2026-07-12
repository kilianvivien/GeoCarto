import { useCallback, useEffect, useRef } from 'react';
import { geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeoJsonLayer, ProjectionConfig } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { buildD3Projection } from '@/projection/projections';
import { createD3CanvasProjection } from '@/projection/canvasProjectionAdapter';
import { loadNaturalEarthCountries, loadNaturalEarthLand } from '@/basemap/naturalEarthOutlines';
import { hintHistoryLabel } from '@/state/historyStore';
import { drawProjectedScene } from './projectedRender';
import { useMapInstance } from './mapInstance';

/**
 * Canvas2D sibling of `MapView` for `engine: 'projected'` documents — d3-geo
 * has no notion of GPU tiles, so this draws bundled Natural Earth land
 * outlines plus the project's own GeoJSON layers directly with `d3.geoPath`.
 * Registers a `CanvasProjection` into the shared `mapInstance` store (leaving
 * `map` null) so annotation anchoring/export work the same as the Mercator path.
 */
export function ProjectedMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landRef = useRef<FeatureCollection<Geometry> | null>(null);
  const countriesRef = useRef<FeatureCollection<Geometry> | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; rotateLambda: number } | null>(null);
  // Touch pinch-to-scale: the projection scale otherwise only changes via the
  // wheel, which doesn't exist on an iPad.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistanceRef = useRef<number | null>(null);

  const activePinchDistance = () => {
    if (pointersRef.current.size < 2) return null;
    const [a, b] = pointersRef.current.values();
    return Math.hypot(b.x - a.x, b.y - a.y) || 1;
  };

  const projectionConfig = useDocumentStore((s) => s.project.projection);
  const layers = useDocumentStore((s) => s.project.layers);
  const exportFrame = useDocumentStore((s) => s.project.exportFrame);

  // Keep latest props reachable from the rAF-deferred `draw` without re-subscribing.
  const configRef = useRef<ProjectionConfig | null>(projectionConfig);
  const layersRef = useRef<GeoJsonLayer[]>(layers);
  const frameWidthRef = useRef<number>(exportFrame.width);
  configRef.current = projectionConfig;
  layersRef.current = layers;
  frameWidthRef.current = exportFrame.width;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const config = configRef.current;
    if (!canvas || !container || !config) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // `config.scale`/`config.center` are fitted to `exportFrame` pixel space
    // (see `fitProjectionToFrame`), but this canvas is sized to the live CSS
    // container, which is a scaled-down/up view of that same frame (see
    // `containFrame` in MapCanvas.tsx) — rescale here the same way
    // `renderProjectedBasemapCanvas` does for export, or the map renders
    // off-center/clipped whenever the container isn't exactly frame-sized.
    const frameWidth = frameWidthRef.current;
    const scaleFactor = frameWidth > 0 ? width / frameWidth : 1;
    const scaledConfig: ProjectionConfig = {
      ...config,
      scale: config.scale * scaleFactor,
      center: [config.center[0] * scaleFactor, config.center[1] * scaleFactor],
    };
    const d3proj = buildD3Projection(scaledConfig);
    useMapInstance.getState().setProjection(createD3CanvasProjection(d3proj));
    const path = geoPath(d3proj, ctx);
    drawProjectedScene(ctx, path, landRef.current, layersRef.current, 0.75, countriesRef.current);
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const sync = () =>
      useMapInstance.getState().setContainerSize({ width: container.clientWidth, height: container.clientHeight });
    const observer = new ResizeObserver(() => {
      sync();
      scheduleRedraw();
    });
    observer.observe(container);
    sync();
    return () => {
      observer.disconnect();
      useMapInstance.getState().setContainerSize(null);
    };
  }, [scheduleRedraw]);

  // The scaled-to-container projection is registered from `draw` (it alone
  // knows the live container width needed to compute the correct scale) —
  // this effect only clears the registration when there's no config to draw,
  // and on unmount.
  useEffect(() => {
    if (!projectionConfig) useMapInstance.getState().setProjection(null);
    return () => useMapInstance.getState().setProjection(null);
  }, [projectionConfig]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadNaturalEarthLand(), loadNaturalEarthCountries()]).then(([land, countries]) => {
      if (cancelled) return;
      landRef.current = land;
      countriesRef.current = countries;
      scheduleRedraw();
    });
    return () => {
      cancelled = true;
    };
  }, [scheduleRedraw]);

  useEffect(() => {
    scheduleRedraw();
  }, [projectionConfig, layers, exportFrame, scheduleRedraw]);

  useEffect(
    () => () => {
      // Must null out `rafRef` after cancelling, not just cancel — otherwise
      // `scheduleRedraw`'s `rafRef.current !== null` guard sees a stale non-null
      // id forever. Under React 18 StrictMode's dev-mode mount→cleanup→mount
      // simulation this cleanup fires once on the very first mount, and without
      // the reset it permanently blocks every later `scheduleRedraw` call — the
      // canvas silently never draws again after that.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      data-testid="projected-map-view"
      className="relative h-full w-full touch-none bg-[var(--surface)]"
      onPointerDown={(event) => {
        const config = configRef.current;
        if (!config || event.button !== 0) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        event.currentTarget.setPointerCapture(event.pointerId);
        if (pointersRef.current.size >= 2) {
          // Second finger: switch from rotating to pinch-scaling.
          dragRef.current = null;
          pinchDistanceRef.current = activePinchDistance();
          return;
        }
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, rotateLambda: config.rotateLambda };
      }}
      onPointerMove={(event) => {
        if (pointersRef.current.has(event.pointerId)) {
          pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
        const config = configRef.current;
        const lastDistance = pinchDistanceRef.current;
        if (config && lastDistance !== null) {
          const distance = activePinchDistance();
          if (distance === null) return;
          pinchDistanceRef.current = distance;
          const scale = Math.max(40, Math.min(2000, config.scale * (distance / lastDistance)));
          hintHistoryLabel('Scale projection');
          useDocumentStore.getState().setProjectionConfig({ scale });
          return;
        }
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const next = ((drag.rotateLambda + (event.clientX - drag.startX) * 0.35 + 180) % 360) - 180;
        hintHistoryLabel('Rotate projection');
        useDocumentStore.getState().setProjectionConfig({ rotateLambda: next });
      }}
      onPointerUp={(event) => {
        pointersRef.current.delete(event.pointerId);
        if (pointersRef.current.size < 2) pinchDistanceRef.current = null;
        if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
      }}
      onPointerCancel={(event) => {
        pointersRef.current.delete(event.pointerId);
        if (pointersRef.current.size < 2) pinchDistanceRef.current = null;
        dragRef.current = null;
      }}
      onWheel={(event) => {
        const config = configRef.current;
        if (!config) return;
        event.preventDefault();
        const scale = Math.max(40, Math.min(2000, config.scale * Math.exp(-event.deltaY * 0.0015)));
        hintHistoryLabel('Scale projection');
        useDocumentStore.getState().setProjectionConfig({ scale });
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
