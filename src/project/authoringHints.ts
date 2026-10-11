import { create } from 'zustand';

export type FrameCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const FRAME_CORNERS: FrameCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/**
 * Layout intent that an authored project can only express relative to the
 * map as it will appear — which depends on the window it is opened in:
 * "show these bounds", "put this legend in the top-right corner". They are
 * lifted out of the document on open and resolved once against the live
 * surface (see `AuthoringHintsApplier`), then discarded: from then on the
 * project holds ordinary viewport and position values like any other.
 */
export interface AuthoringHints {
  /** [west, south, east, north] to fit in the frame. Mercator engine only. */
  bounds?: [number, number, number, number];
  /** Canvas annotations to snap to a frame corner, with their estimated box size. */
  placements: { id: string; corner: FrameCorner; width: number; height: number }[];
}

export const useAuthoringHints = create<{ hints: AuthoringHints | null }>(() => ({ hints: null }));
