import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { buildBasemapStyle } from '@/basemap/basemapStyle';
import { ensureLocalPmtilesSource } from '@/basemap/pmtiles';
import { useDocumentStore } from '@/state/documentStore';
import { useViewportStore } from '@/state/viewportStore';
import { useNotices } from '@/ui/notices';
import { translate, useLocale } from '@/i18n/useLocale';
import { useMapInstance } from './mapInstance';
import { isTauri } from '@/app/platform';

const BASEMAP_LOADING_NOTICE_DELAY_MS = 1_200;
const BASEMAP_LOADING_NOTICE_THROTTLE_MS = 10_000;

/**
 * Owns the MapLibre map instance. The map is a disposable projection of the
 * viewport store (PRD §3): it writes navigation back to the store and rebuilds
 * its style when the theme changes — it never owns authoritative state.
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadingNoticeTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const loadingNoticeCycleRef = useRef(0);
  const lastLoadingNoticeAtRef = useRef(0);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const projectViewport = useDocumentStore((s) => s.project.viewport);
  const mode = useDocumentStore((s) => s.project.mode);
  const locale = useLocale((s) => s.locale);
  const isStaticBasemap = basemap.kind === 'static';
  const isEmptyBasemap = basemap.kind === 'empty';
  const hidesMapCanvas = isStaticBasemap || isEmptyBasemap;

  useEffect(() => {
    if (basemap.kind === 'pmtiles-file' && !isTauri()) {
      useNotices.getState().push(translate('basemap.localUnavailable'), 'error');
    }
  }, [basemap]);

  const armBasemapLoadingNotice = useCallback((map: maplibregl.Map) => {
    if (loadingNoticeTimerRef.current) globalThis.clearTimeout(loadingNoticeTimerRef.current);

    const cycle = loadingNoticeCycleRef.current + 1;
    loadingNoticeCycleRef.current = cycle;

    const clearForCycle = () => {
      if (loadingNoticeCycleRef.current !== cycle) return;
      if (loadingNoticeTimerRef.current) globalThis.clearTimeout(loadingNoticeTimerRef.current);
      loadingNoticeTimerRef.current = null;
    };

    map.once('idle', clearForCycle);
    loadingNoticeTimerRef.current = globalThis.setTimeout(() => {
      if (loadingNoticeCycleRef.current !== cycle || map.loaded()) return;
      const now = Date.now();
      if (now - lastLoadingNoticeAtRef.current < BASEMAP_LOADING_NOTICE_THROTTLE_MS) return;
      lastLoadingNoticeAtRef.current = now;
      useNotices.getState().push(translate('basemap.loading'));
    }, BASEMAP_LOADING_NOTICE_DELAY_MS);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { center, zoom, bearing, pitch } = useViewportStore.getState().viewport;
    const initialBasemap = useDocumentStore.getState().project.basemap;
    if (initialBasemap.kind === 'pmtiles-file') ensureLocalPmtilesSource(initialBasemap.path);
    const map = new maplibregl.Map({
      container,
      style: buildBasemapStyle(initialBasemap),
      center,
      zoom,
      bearing,
      pitch,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    useMapInstance.getState().setMap(map);
    armBasemapLoadingNotice(map);

    const syncViewport = () => {
      const c = map.getCenter();
      useViewportStore.getState().setViewport({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      });
    };
    const setCursor = (e: maplibregl.MapMouseEvent) =>
      useViewportStore.getState().setCursor([e.lngLat.lng, e.lngLat.lat]);
    const clearCursor = () => useViewportStore.getState().setCursor(null);

    map.on('move', syncViewport);
    map.on('mousemove', setCursor);
    map.on('mouseout', clearCursor);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      loadingNoticeCycleRef.current += 1;
      if (loadingNoticeTimerRef.current) globalThis.clearTimeout(loadingNoticeTimerRef.current);
      resizeObserver.disconnect();
      useMapInstance.getState().setMap(null);
      map.remove();
      mapRef.current = null;
    };
  }, [armBasemapLoadingNotice]);

  const didMount = useRef(false);
  useEffect(() => {
    // The constructor already applied the initial style — only restyle on change.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (!isStaticBasemap && mapRef.current) {
      if (basemap.kind === 'pmtiles-file') ensureLocalPmtilesSource(basemap.path);
      armBasemapLoadingNotice(mapRef.current);
      // `buildBasemapStyle` reads the active locale for built-in label language,
      // so changing the app language also re-renders the basemap labels.
      mapRef.current.setStyle(buildBasemapStyle(basemap, locale));
    }
  }, [armBasemapLoadingNotice, basemap, isStaticBasemap, locale]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const enabled = mode === 'mapSetup' && !hidesMapCanvas;
    const controls = [
      map.dragPan,
      map.scrollZoom,
      map.boxZoom,
      map.dragRotate,
      map.keyboard,
      map.doubleClickZoom,
      map.touchZoomRotate,
    ];
    for (const control of controls) {
      if (enabled) control.enable();
      else control.disable();
    }
  }, [hidesMapCanvas, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = useViewportStore.getState().viewport;
    const sameCenter =
      current.center[0] === projectViewport.center[0] && current.center[1] === projectViewport.center[1];
    const sameCamera =
      sameCenter &&
      current.zoom === projectViewport.zoom &&
      current.bearing === projectViewport.bearing &&
      current.pitch === projectViewport.pitch;
    if (sameCamera) return;
    map.jumpTo(projectViewport);
    useViewportStore.getState().setViewport(projectViewport);
  }, [projectViewport]);

  return (
    <div
      ref={containerRef}
      data-testid="map-view"
      className={`h-full w-full ${hidesMapCanvas ? 'opacity-0' : ''}`}
    />
  );
}
