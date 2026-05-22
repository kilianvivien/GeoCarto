import { create } from 'zustand';
import type maplibregl from 'maplibre-gl';

interface MapInstanceState {
  /** The live MapLibre map, or null before it mounts. */
  map: maplibregl.Map | null;
  setMap: (map: maplibregl.Map | null) => void;
}

/**
 * Holds the MapLibre instance so non-owning components (layer sync, future
 * controls) can reach it without prop-drilling. MapView is the sole writer.
 */
export const useMapInstance = create<MapInstanceState>((set) => ({
  map: null,
  setMap: (map) => set({ map }),
}));
