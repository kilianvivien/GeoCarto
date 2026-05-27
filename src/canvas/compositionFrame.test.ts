import { describe, expect, it } from 'vitest';
import { computeFrameBox, frameZoomDelta } from './compositionFrame';

describe('composition frame geometry', () => {
  it('fits a wide frame to the canvas width cap', () => {
    const box = computeFrameBox(1000, 800, 16 / 9);
    expect(box.width).toBeCloseTo(860);
    expect(box.height).toBeCloseTo(483.75);
  });

  it('fits a tall frame to the canvas height ratio', () => {
    const box = computeFrameBox(1000, 800, 3 / 4);
    expect(box.height).toBeCloseTo(624);
    expect(box.width).toBeCloseTo(468);
  });

  it('returns a positive zoom delta when the frame is inset inside the canvas', () => {
    expect(frameZoomDelta(1000, 800, 4 / 3)).toBeGreaterThan(0);
  });
});
