import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { buildBasemapStyle } from '@/basemap/basemapStyle';
import { useDocumentStore } from '@/state/documentStore';
import { useViewportStore } from '@/state/viewportStore';
import { useMapInstance } from './mapInstance';

/**
 * Owns the MapLibre map instance. The map is a disposable projection of the
 * viewport store (PRD §3): it writes navigation back to the store and rebuilds
 * its style when the theme changes — it never owns authoritative state.
 */
export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const basemap = useDocumentStore((s) => s.project.basemap);
  const mode = useDocumentStore((s) => s.project.mode);
  const isStaticBasemap = basemap.kind === 'static';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { center, zoom, bearing, pitch } = useViewportStore.getState().viewport;
    const map = new maplibregl.Map({
      container,
      style: buildBasemapStyle(useDocumentStore.getState().project.basemap),
      center,
      zoom,
      bearing,
      pitch,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    useMapInstance.getState().setMap(map);

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

    return () => {
      useMapInstance.getState().setMap(null);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const didMount = useRef(false);
  useEffect(() => {
    // The constructor already applied the initial style — only restyle on change.
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (!isStaticBasemap) mapRef.current?.setStyle(buildBasemapStyle(basemap));
  }, [basemap, isStaticBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const enabled = mode === 'mapSetup' && !isStaticBasemap;
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
  }, [mode, isStaticBasemap]);

  return (
    <div
      ref={containerRef}
      data-testid="map-view"
      className={`h-full w-full ${isStaticBasemap ? 'opacity-0' : ''}`}
    />
  );
}
