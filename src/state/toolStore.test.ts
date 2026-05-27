import { describe, expect, it } from 'vitest';
import { isToolEnabled, SHORTCUT_TO_TOOL, TOOL_BY_KEY, TOOL_DEFINITIONS } from './toolStore';

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

  it('gates visible future Phase 2 placeholders', () => {
    for (const key of ['paint', 'image', 'legend', 'comment'] as const) {
      expect(TOOL_BY_KEY[key].phase).toBe('phase2');
      expect(TOOL_BY_KEY[key].enabled).toBe(false);
      expect(TOOL_BY_KEY[key].disabledReason).toContain('Phase 2');
    }
  });

  // M7 toolbar gate lock — Phase 2 tools must stay disabled until their
  // owning milestone lands. Flip `enabled` only in the same change that
  // ships the tool's implementation, never as a drive-by edit.
  it('keeps future Phase 2 tools disabled', () => {
    const shipped = new Set(['marquee', 'ruler']);
    for (const tool of TOOL_DEFINITIONS) {
      if (tool.phase === 'phase2' && !shipped.has(tool.key)) {
        expect(tool.enabled, `${tool.key} must stay disabled until Phase 2 ships it`).toBe(false);
      }
    }
  });
});
