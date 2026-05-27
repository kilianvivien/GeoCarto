import { beforeEach, describe, expect, it } from 'vitest';
import { useViewTransformStore } from './viewTransformStore';

describe('viewTransformStore', () => {
  beforeEach(() => {
    useViewTransformStore.getState().reset();
  });

  it('zooms around the provided screen anchor', () => {
    useViewTransformStore.getState().setZoomAt(2, { x: 100, y: 80 });

    expect(useViewTransformStore.getState().zoom).toBe(2);
    expect(useViewTransformStore.getState().pan).toEqual({ x: -100, y: -80 });
  });

  it('pans and resets the screen-only transform', () => {
    useViewTransformStore.getState().panBy({ x: 12, y: -8 });
    useViewTransformStore.getState().reset();

    expect(useViewTransformStore.getState().zoom).toBe(1);
    expect(useViewTransformStore.getState().pan).toEqual({ x: 0, y: 0 });
  });
});
