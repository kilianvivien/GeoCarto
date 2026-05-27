import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export interface CanvasViewTransform {
  zoom: number;
  pan: { x: number; y: number };
}

interface ViewTransformState extends CanvasViewTransform {
  setZoomAt: (zoom: number, anchor: { x: number; y: number }) => void;
  zoomBy: (factor: number, anchor: { x: number; y: number }) => void;
  panBy: (delta: { x: number; y: number }) => void;
  reset: () => void;
}

export const DEFAULT_VIEW_TRANSFORM: CanvasViewTransform = {
  zoom: 1,
  pan: { x: 0, y: 0 },
};

/**
 * Screen-only transform for inspecting the locked composition. It never writes
 * into the project document, so export and saved geometry stay authoritative.
 */
export const useViewTransformStore = create<ViewTransformState>()(
  immer((set) => ({
    ...DEFAULT_VIEW_TRANSFORM,
    setZoomAt: (nextZoom, anchor) =>
      set((state) => {
        const zoom = clampZoom(nextZoom);
        const localX = (anchor.x - state.pan.x) / state.zoom;
        const localY = (anchor.y - state.pan.y) / state.zoom;
        state.zoom = zoom;
        state.pan = {
          x: anchor.x - localX * zoom,
          y: anchor.y - localY * zoom,
        };
      }),
    zoomBy: (factor, anchor) =>
      set((state) => {
        const zoom = clampZoom(state.zoom * factor);
        const localX = (anchor.x - state.pan.x) / state.zoom;
        const localY = (anchor.y - state.pan.y) / state.zoom;
        state.zoom = zoom;
        state.pan = {
          x: anchor.x - localX * zoom,
          y: anchor.y - localY * zoom,
        };
      }),
    panBy: (delta) =>
      set((state) => {
        state.pan.x += delta.x;
        state.pan.y += delta.y;
      }),
    reset: () =>
      set((state) => {
        state.zoom = DEFAULT_VIEW_TRANSFORM.zoom;
        state.pan = { ...DEFAULT_VIEW_TRANSFORM.pan };
      }),
  })),
);
