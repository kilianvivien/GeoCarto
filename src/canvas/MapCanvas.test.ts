import { describe, expect, it } from 'vitest';
import { canvasAnchorFromClientPoint } from './canvasCoordinates';

describe('canvasAnchorFromClientPoint', () => {
  it('converts viewport coordinates to the untransformed map surface coordinate space', () => {
    expect(
      canvasAnchorFromClientPoint(
        { x: 420, y: 260 },
        { left: 100, top: 40 },
        { x: 32, y: 18 },
      ),
    ).toEqual({ x: 288, y: 202 });
  });
});
