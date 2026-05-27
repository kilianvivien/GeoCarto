import { describe, expect, it } from 'vitest';
import { isToolEnabled, SHORTCUT_TO_TOOL, TOOL_BY_KEY } from './toolStore';

describe('tool metadata', () => {
  it('maps Phase 1 shortcuts to implemented tools', () => {
    expect(SHORTCUT_TO_TOOL.p).toBe('pen');
    expect(SHORTCUT_TO_TOOL.g).toBe('polygon');
    expect(isToolEnabled(SHORTCUT_TO_TOOL.p)).toBe(true);
    expect(isToolEnabled(SHORTCUT_TO_TOOL.g)).toBe(true);
  });

  it('gates visible Phase 2 placeholders', () => {
    for (const key of ['ruler', 'marquee', 'paint', 'image', 'legend', 'comment'] as const) {
      expect(TOOL_BY_KEY[key].phase).toBe('phase2');
      expect(TOOL_BY_KEY[key].enabled).toBe(false);
      expect(TOOL_BY_KEY[key].disabledReason).toContain('Phase 2');
    }
  });
});
