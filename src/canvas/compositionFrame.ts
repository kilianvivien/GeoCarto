/**
 * Geometry for the composition frame — the centered box shown during map setup
 * that defines the export region. Shared by ExportFrame (which draws it) and the
 * lock handler (which zooms the map so the box fills the canvas).
 */

/** The box height as a fraction of the canvas, before the width cap applies. */
export const FRAME_HEIGHT_RATIO = 0.78;
/** The box may not exceed this fraction of the canvas width. */
export const FRAME_MAX_WIDTH_RATIO = 0.86;

export interface FrameBox {
  width: number;
  height: number;
}

/** Pixel size of the centered composition box for a given canvas and aspect ratio. */
export function computeFrameBox(canvasWidth: number, canvasHeight: number, aspect: number): FrameBox {
  let height = canvasHeight * FRAME_HEIGHT_RATIO;
  let width = height * aspect;
  const maxWidth = canvasWidth * FRAME_MAX_WIDTH_RATIO;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspect;
  }
  return { width, height };
}

/**
 * Zoom delta to add on lock so the composition box fills the canvas. The box is
 * centered, so the center is unchanged; only zoom changes. The binding dimension
 * fills exactly and the other shows a thin strip of extra map (the canvas aspect
 * rarely matches the frame aspect).
 */
export function frameZoomDelta(canvasWidth: number, canvasHeight: number, aspect: number): number {
  const box = computeFrameBox(canvasWidth, canvasHeight, aspect);
  const fill = Math.max(box.width / canvasWidth, box.height / canvasHeight);
  return -Math.log2(fill);
}
