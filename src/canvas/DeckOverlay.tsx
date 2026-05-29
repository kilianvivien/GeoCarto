import { useEffect, useRef } from 'react';
import { useDocumentStore } from '@/state/documentStore';
import { attachHeatmapOverlay, heatmapLayers } from '@/layers/deckHeatmap';
import { useMapInstance } from './mapInstance';

/**
 * Headless renderer for deck.gl data layers (Milestone 12). Mirrors the
 * document's heatmap-strategy layers onto a MapboxOverlay interleaved with the
 * MapLibre basemap. deck.gl is imported lazily the first time a heatmap layer
 * exists, so the dependency stays out of the initial bundle.
 */
export function DeckOverlay() {
  const map = useMapInstance((s) => s.map);
  const layers = useDocumentStore((s) => s.project.layers);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;

    // Skip all deck work (and the lazy import) until a heatmap layer exists.
    if (heatmapLayers(layers).length === 0 && !overlayRef.current) return;

    void (async () => {
      const next = await attachHeatmapOverlay(map, layers, overlayRef.current);
      if (cancelled) {
        if (next) map.removeControl(next as never);
        return;
      }
      overlayRef.current = next;
    })();

    return () => {
      cancelled = true;
    };
  }, [map, layers]);

  useEffect(() => {
    return () => {
      const overlay = overlayRef.current;
      const map = useMapInstance.getState().map;
      if (overlay && map) map.removeControl(overlay as never);
      overlayRef.current = null;
    };
  }, []);

  return null;
}
