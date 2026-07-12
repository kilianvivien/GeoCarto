/**
 * Two-finger navigation for touch devices (iPad PWA, tablets). Tracks touch
 * pointers on the canvas and turns two-finger motion into workspace pan/zoom
 * deltas, while telling the caller which native events must be swallowed so
 * they never leak into Konva/annotation tools as taps, drags, or strokes.
 *
 * Pen ("Apple Pencil") pointers are deliberately not tracked — the pencil
 * draws while the other hand navigates.
 */

export interface GesturePoint {
  x: number;
  y: number;
}

/** One incremental frame of a two-finger gesture. */
export interface PinchUpdate {
  /** Centroid movement since the previous frame, in client px. */
  panDelta: GesturePoint;
  /** Finger-spread ratio since the previous frame (1 = no zoom change). */
  zoomFactor: number;
  /** Current two-finger centroid, in client coordinates — the zoom anchor. */
  centroid: GesturePoint;
}

/**
 * What the caller should do with the native event that produced this update:
 * `passthrough` lets it continue to the annotation stage / Konva, `swallow`
 * stops it (it belongs to the navigation gesture).
 */
export type GestureVerdict = 'passthrough' | 'swallow';

function centroidOf(a: GesturePoint, b: GesturePoint): GesturePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distanceOf(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y) || 1;
}

export class TouchGestureTracker {
  private pointers = new Map<number, GesturePoint>();
  private baseline: { centroid: GesturePoint; distance: number } | null = null;
  private gestureActive = false;

  /** True from the moment a second finger lands until every finger lifts. */
  get active(): boolean {
    return this.gestureActive;
  }

  private firstTwo(): [GesturePoint, GesturePoint] | null {
    if (this.pointers.size < 2) return null;
    const [a, b] = this.pointers.values();
    return [a, b];
  }

  private rebaseline(): void {
    const pair = this.firstTwo();
    this.baseline = pair ? { centroid: centroidOf(...pair), distance: distanceOf(...pair) } : null;
  }

  /** `gesture-start` means swallow AND cancel in-progress single-finger work. */
  down(pointerId: number, point: GesturePoint): GestureVerdict | 'gesture-start' {
    this.pointers.set(pointerId, point);
    if (this.pointers.size >= 2) {
      const starting = !this.gestureActive;
      this.gestureActive = true;
      this.rebaseline();
      return starting ? 'gesture-start' : 'swallow';
    }
    // While the gesture is winding down (one finger left), fresh touches still
    // belong to navigation, not to the tools.
    return this.gestureActive ? 'swallow' : 'passthrough';
  }

  /**
   * Returns a pinch frame while two fingers are down, or a plain verdict:
   * untracked pointers pass through, tracked ones are swallowed while the
   * gesture owns them.
   */
  move(pointerId: number, point: GesturePoint): PinchUpdate | GestureVerdict {
    if (!this.pointers.has(pointerId)) return 'passthrough';
    this.pointers.set(pointerId, point);
    if (!this.gestureActive) return 'passthrough';
    const pair = this.firstTwo();
    if (!pair || !this.baseline) return 'swallow';
    const centroid = centroidOf(...pair);
    const distance = distanceOf(...pair);
    const update: PinchUpdate = {
      panDelta: {
        x: centroid.x - this.baseline.centroid.x,
        y: centroid.y - this.baseline.centroid.y,
      },
      zoomFactor: distance / this.baseline.distance,
      centroid,
    };
    this.baseline = { centroid, distance };
    return update;
  }

  up(pointerId: number): GestureVerdict {
    if (!this.pointers.has(pointerId)) return 'passthrough';
    this.pointers.delete(pointerId);
    if (!this.gestureActive) return 'passthrough';
    if (this.pointers.size === 0) {
      this.gestureActive = false;
      this.baseline = null;
    } else {
      // A finger changed — rebaseline so remaining fingers don't cause a jump.
      this.rebaseline();
    }
    return 'swallow';
  }

  reset(): void {
    this.pointers.clear();
    this.baseline = null;
    this.gestureActive = false;
  }
}

/**
 * Fired on `window` the moment a two-finger navigation gesture starts, so
 * in-progress single-finger interactions (brush stroke, marquee, Konva drag)
 * can cancel themselves instead of being left half-finished when their
 * pointer's remaining events are swallowed.
 */
export const CANVAS_GESTURE_START_EVENT = 'geocarto:canvas-gesture-start';

export function dispatchCanvasGestureStart(): void {
  window.dispatchEvent(new CustomEvent(CANVAS_GESTURE_START_EVENT));
}
