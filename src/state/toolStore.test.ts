import { beforeEach, describe, expect, it } from 'vitest';
import {
  isToolEnabled,
  SHORTCUT_TO_TOOL,
  TOOL_BY_KEY,
  TOOL_DEFINITIONS,
  useToolStore,
} from './toolStore';

describe('tool metadata', () => {
  it('maps Phase 1 shortcuts to implemented tools', () => {
    expect(SHORTCUT_TO_TOOL.p).toBe('pen');
    expect(SHORTCUT_TO_TOOL.g).toBe('polygon');
    expect(isToolEnabled(SHORTCUT_TO_TOOL.p)).toBe(true);
    expect(isToolEnabled(SHORTCUT_TO_TOOL.g)).toBe(true);
  });

  it('enables Milestone 10 canvas-aid tools', () => {
    for (const key of ['ruler', 'marquee'] as const) {
      expect(TOOL_BY_KEY[key].phase).toBe('phase2');
      expect(TOOL_BY_KEY[key].enabled).toBe(true);
    }
  });

  it('enables previously-gated Phase 2 placeholders', () => {
    for (const key of ['paint', 'image', 'legend', 'comment'] as const) {
      expect(TOOL_BY_KEY[key].phase).toBe('phase2');
      expect(TOOL_BY_KEY[key].enabled).toBe(true);
    }
  });

  it('keeps no Phase 2 tools disabled (all milestones shipped)', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.enabled, `${tool.key} should be enabled`).toBe(true);
    }
  });
});

describe('master snap toggle', () => {
  beforeEach(() => {
    useToolStore.setState({
      gridSnapEnabled: false,
      smartGuidesEnabled: true,
      snapMemory: null,
    });
  });

  it('turns both flags off when either is on, caching prior state', () => {
    useToolStore.getState().toggleMasterSnap();
    const state = useToolStore.getState();
    expect(state.gridSnapEnabled).toBe(false);
    expect(state.smartGuidesEnabled).toBe(false);
    expect(state.snapMemory).toEqual({ grid: false, smart: true });
  });

  it('restores the cached state when toggled back on', () => {
    useToolStore.setState({ gridSnapEnabled: true, smartGuidesEnabled: true });
    useToolStore.getState().toggleMasterSnap();
    useToolStore.getState().toggleMasterSnap();
    const state = useToolStore.getState();
    expect(state.gridSnapEnabled).toBe(true);
    expect(state.smartGuidesEnabled).toBe(true);
    expect(state.snapMemory).toBeNull();
  });

  it('defaults to both-on when no prior state was cached', () => {
    useToolStore.setState({ gridSnapEnabled: false, smartGuidesEnabled: false, snapMemory: null });
    useToolStore.getState().toggleMasterSnap();
    const state = useToolStore.getState();
    expect(state.gridSnapEnabled).toBe(true);
    expect(state.smartGuidesEnabled).toBe(true);
  });
});
