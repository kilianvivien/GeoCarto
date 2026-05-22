import { describe, expect, it, beforeEach } from 'vitest';
import { useViewportStore, DEFAULT_VIEWPORT } from './viewportStore';

describe('viewportStore', () => {
  beforeEach(() => {
    useViewportStore.setState({ viewport: DEFAULT_VIEWPORT, cursor: null });
  });

  it('starts at the default viewport', () => {
    expect(useViewportStore.getState().viewport).toEqual(DEFAULT_VIEWPORT);
  });

  it('replaces the viewport via setViewport', () => {
    const next = { center: [2.35, 48.85] as [number, number], zoom: 9, bearing: 12, pitch: 0 };
    useViewportStore.getState().setViewport(next);
    expect(useViewportStore.getState().viewport).toEqual(next);
  });

  it('tracks and clears the cursor position', () => {
    useViewportStore.getState().setCursor([1, 2]);
    expect(useViewportStore.getState().cursor).toEqual([1, 2]);
    useViewportStore.getState().setCursor(null);
    expect(useViewportStore.getState().cursor).toBeNull();
  });
});
