import { describe, expect, it } from 'vitest';
import { TouchGestureTracker, type PinchUpdate } from './touchGestures';

function asUpdate(result: PinchUpdate | string): PinchUpdate {
  if (typeof result === 'string') throw new Error(`expected a pinch update, got "${result}"`);
  return result;
}

describe('TouchGestureTracker', () => {
  it('passes a single finger through to the tools', () => {
    const tracker = new TouchGestureTracker();
    expect(tracker.down(1, { x: 10, y: 10 })).toBe('passthrough');
    expect(tracker.move(1, { x: 20, y: 10 })).toBe('passthrough');
    expect(tracker.up(1)).toBe('passthrough');
    expect(tracker.active).toBe(false);
  });

  it('ignores pointers it never saw go down', () => {
    const tracker = new TouchGestureTracker();
    expect(tracker.move(7, { x: 0, y: 0 })).toBe('passthrough');
    expect(tracker.up(7)).toBe('passthrough');
  });

  it('starts a gesture when the second finger lands', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    expect(tracker.down(2, { x: 100, y: 0 })).toBe('gesture-start');
    expect(tracker.active).toBe(true);
  });

  it('reports pan deltas for parallel two-finger movement', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    tracker.down(2, { x: 100, y: 0 });
    const update = asUpdate(tracker.move(1, { x: 10, y: 20 }));
    // Finger 1 moved (+10, +20); the centroid moved half that.
    expect(update.panDelta).toEqual({ x: 5, y: 10 });
    const second = asUpdate(tracker.move(2, { x: 110, y: 20 }));
    expect(second.panDelta).toEqual({ x: 5, y: 10 });
    // Fingers move one event at a time, so spread changes transiently — but a
    // parallel translation nets out to no zoom across the two frames.
    expect(update.zoomFactor * second.zoomFactor).toBeCloseTo(1, 5);
  });

  it('reports zoom factors when fingers spread apart', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    tracker.down(2, { x: 100, y: 0 });
    const update = asUpdate(tracker.move(2, { x: 200, y: 0 }));
    expect(update.zoomFactor).toBeCloseTo(2, 5);
    expect(update.centroid).toEqual({ x: 100, y: 0 });
    // Incremental: the next frame is measured against the new baseline.
    const next = asUpdate(tracker.move(2, { x: 200, y: 0 }));
    expect(next.zoomFactor).toBeCloseTo(1, 5);
    expect(next.panDelta).toEqual({ x: 0, y: 0 });
  });

  it('keeps swallowing the last finger after the other lifts, without jumps', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    tracker.down(2, { x: 100, y: 0 });
    expect(tracker.up(1)).toBe('swallow');
    expect(tracker.active).toBe(true);
    expect(tracker.move(2, { x: 150, y: 0 })).toBe('swallow');
    expect(tracker.up(2)).toBe('swallow');
    expect(tracker.active).toBe(false);
    // After the gesture fully ends, a new single finger is a normal tool touch.
    expect(tracker.down(3, { x: 0, y: 0 })).toBe('passthrough');
  });

  it('rebaselines when a third finger joins so the view does not jump', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    tracker.down(2, { x: 100, y: 0 });
    expect(tracker.down(3, { x: 500, y: 500 })).toBe('swallow');
    const update = asUpdate(tracker.move(1, { x: 0, y: 0 }));
    expect(update.panDelta).toEqual({ x: 0, y: 0 });
    expect(update.zoomFactor).toBeCloseTo(1, 5);
  });

  it('resets cleanly', () => {
    const tracker = new TouchGestureTracker();
    tracker.down(1, { x: 0, y: 0 });
    tracker.down(2, { x: 100, y: 0 });
    tracker.reset();
    expect(tracker.active).toBe(false);
    expect(tracker.down(1, { x: 0, y: 0 })).toBe('passthrough');
  });
});
