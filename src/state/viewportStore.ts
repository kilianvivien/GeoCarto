import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface Viewport {
  /** [longitude, latitude] */
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

interface ViewportState {
  viewport: Viewport;
  /** Cursor position over the map in [lng, lat], or null when off-map. */
  cursor: [number, number] | null;
  setViewport: (next: Viewport) => void;
  setCursor: (next: [number, number] | null) => void;
}

/** Default opening view — Western Europe. */
export const DEFAULT_VIEWPORT: Viewport = {
  center: [6, 48],
  zoom: 4.2,
  bearing: 0,
  pitch: 0,
};

/**
 * Authoritative viewport state. MapLibre writes here on `moveend`; the status
 * bar and zoom display read from here. Renderers project this state, per PRD §3.
 */
export const useViewportStore = create<ViewportState>()(
  immer((set) => ({
    viewport: DEFAULT_VIEWPORT,
    cursor: null,
    setViewport: (next) =>
      set((state) => {
        state.viewport = next;
      }),
    setCursor: (next) =>
      set((state) => {
        state.cursor = next;
      }),
  })),
);
