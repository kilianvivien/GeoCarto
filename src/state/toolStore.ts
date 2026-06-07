import { create } from 'zustand';
import {
  DEFAULT_ANNOTATION_STYLE,
  type AnnotationAnchorMode,
  type AnnotationKind,
  type AnnotationStyle,
} from '@/project/cartoproj';
import { usePreferencesStore } from './preferencesStore';

export type ToolKey =
  | 'move'
  | 'marquee'
  | 'pan'
  | 'ruler'
  | 'pen'
  | 'rectangle'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'paint'
  | 'pin'
  | 'arrow'
  | 'image'
  | 'legend'
  | 'comment';

export interface ToolDefinition {
  key: ToolKey;
  name: string;
  shortcut: string;
  phase: 'phase1' | 'phase2';
  enabled: boolean;
  disabledReason?: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  { key: 'move', name: 'Move', shortcut: 'V', phase: 'phase1', enabled: true },
  {
    key: 'marquee',
    name: 'Marquee',
    shortcut: 'M',
    phase: 'phase2',
    enabled: true,
  },
  {
    key: 'pan',
    name: 'Pan',
    shortcut: 'H',
    phase: 'phase1',
    enabled: true,
  },
  {
    key: 'ruler',
    name: 'Ruler',
    shortcut: 'K',
    phase: 'phase2',
    enabled: true,
  },
  { key: 'pen', name: 'Line', shortcut: 'P', phase: 'phase1', enabled: true },
  { key: 'rectangle', name: 'Rectangle', shortcut: 'R', phase: 'phase1', enabled: true },
  { key: 'ellipse', name: 'Ellipse', shortcut: 'O', phase: 'phase1', enabled: true },
  { key: 'polygon', name: 'Polygon', shortcut: 'G', phase: 'phase1', enabled: true },
  { key: 'text', name: 'Text', shortcut: 'T', phase: 'phase1', enabled: true },
  {
    key: 'paint',
    name: 'Brush',
    shortcut: 'B',
    phase: 'phase2',
    enabled: true,
  },
  { key: 'pin', name: 'Pin', shortcut: 'I', phase: 'phase1', enabled: true },
  { key: 'arrow', name: 'Arrow', shortcut: 'A', phase: 'phase1', enabled: true },
  {
    key: 'image',
    name: 'Image',
    shortcut: 'J',
    phase: 'phase2',
    enabled: true,
  },
  {
    key: 'legend',
    name: 'Legend',
    shortcut: 'L',
    phase: 'phase2',
    enabled: true,
  },
  {
    key: 'comment',
    name: 'Comment',
    shortcut: 'C',
    phase: 'phase2',
    enabled: true,
  },
];

export const TOOL_BY_KEY = Object.fromEntries(
  TOOL_DEFINITIONS.map((tool) => [tool.key, tool]),
) as Record<ToolKey, ToolDefinition>;

export const SHORTCUT_TO_TOOL: Record<string, ToolKey> = {
  v: 'move',
  m: 'marquee',
  h: 'pan',
  k: 'ruler',
  p: 'pen',
  r: 'rectangle',
  o: 'ellipse',
  g: 'polygon',
  t: 'text',
  b: 'paint',
  i: 'pin',
  a: 'arrow',
  j: 'image',
  l: 'legend',
  c: 'comment',
};

export function isToolEnabled(tool: ToolKey): boolean {
  return TOOL_BY_KEY[tool].enabled;
}

export const DRAWABLE_TOOLS = new Set<ToolKey>([
  'rectangle',
  'ellipse',
  'polygon',
  'text',
  'pin',
  'arrow',
  'paint',
  'image',
  'legend',
  'comment',
]);

export function toolToAnnotationKind(tool: ToolKey): AnnotationKind | null {
  if (tool === 'rectangle' || tool === 'ellipse' || tool === 'polygon') return tool;
  if (tool === 'text' || tool === 'pin' || tool === 'arrow') return tool;
  if (tool === 'pen') return 'line';
  if (tool === 'ruler') return 'measurement';
  // Brush uses a drag-to-draw flow that commits an open freehand line.
  if (tool === 'paint') return 'line';
  if (tool === 'image') return 'image';
  if (tool === 'legend') return 'legend';
  if (tool === 'comment') return 'comment';
  return null;
}

interface ToolState {
  activeTool: ToolKey;
  defaultAnchorMode: AnnotationAnchorMode;
  defaultStyle: AnnotationStyle;
  gridSnapEnabled: boolean;
  gridSpacing: number;
  smartGuidesEnabled: boolean;
  /**
   * Snapshot captured before the master snap toggle flips both flags off. Lets a
   * follow-up toggle restore the user's prior granular preferences.
   */
  snapMemory: { grid: boolean; smart: boolean } | null;
  setActiveTool: (tool: ToolKey) => void;
  setDefaultAnchorMode: (mode: AnnotationAnchorMode) => void;
  updateDefaultStyle: (patch: Partial<AnnotationStyle>) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setGridSpacing: (spacing: number) => void;
  setSmartGuidesEnabled: (enabled: boolean) => void;
  toggleMasterSnap: () => void;
}

// Seed the live canvas-aid state from the persisted app defaults (M21). The
// status-bar toggles mutate these live values only — they never write back to
// preferences, so the saved default stays the seed for the next launch.
const canvasDefaults = usePreferencesStore.getState();

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'move',
  defaultAnchorMode: 'canvas',
  defaultStyle: { ...DEFAULT_ANNOTATION_STYLE },
  gridSnapEnabled: canvasDefaults.gridSnapDefault,
  gridSpacing: canvasDefaults.gridSpacingDefault,
  smartGuidesEnabled: canvasDefaults.smartGuidesDefault,
  snapMemory: null,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setDefaultAnchorMode: (mode) => set({ defaultAnchorMode: mode }),
  updateDefaultStyle: (patch) =>
    set((state) => ({ defaultStyle: { ...state.defaultStyle, ...patch } })),
  setGridSnapEnabled: (gridSnapEnabled) => set({ gridSnapEnabled, snapMemory: null }),
  setGridSpacing: (spacing) => set({ gridSpacing: Math.max(4, Math.min(200, spacing)) }),
  setSmartGuidesEnabled: (smartGuidesEnabled) => set({ smartGuidesEnabled, snapMemory: null }),
  toggleMasterSnap: () =>
    set((state) => {
      const anyOn = state.gridSnapEnabled || state.smartGuidesEnabled;
      if (anyOn) {
        return {
          gridSnapEnabled: false,
          smartGuidesEnabled: false,
          snapMemory: { grid: state.gridSnapEnabled, smart: state.smartGuidesEnabled },
        };
      }
      const restored = state.snapMemory ?? { grid: true, smart: true };
      return {
        gridSnapEnabled: restored.grid,
        smartGuidesEnabled: restored.smart,
        snapMemory: null,
      };
    }),
}));
