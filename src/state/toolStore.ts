import { create } from 'zustand';
import {
  DEFAULT_ANNOTATION_STYLE,
  type AnnotationAnchorMode,
  type AnnotationKind,
  type AnnotationStyle,
} from '@/project/cartoproj';

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

export const SHORTCUT_TO_TOOL: Record<string, ToolKey> = {
  v: 'move',
  m: 'marquee',
  h: 'pan',
  k: 'ruler',
  p: 'polygon',
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

export const DRAWABLE_TOOLS = new Set<ToolKey>([
  'rectangle',
  'ellipse',
  'polygon',
  'text',
  'pin',
  'arrow',
]);

export function toolToAnnotationKind(tool: ToolKey): AnnotationKind | null {
  if (tool === 'rectangle' || tool === 'ellipse' || tool === 'polygon') return tool;
  if (tool === 'text' || tool === 'pin' || tool === 'arrow') return tool;
  if (tool === 'pen') return 'line';
  return null;
}

interface ToolState {
  activeTool: ToolKey;
  defaultAnchorMode: AnnotationAnchorMode;
  defaultStyle: AnnotationStyle;
  setActiveTool: (tool: ToolKey) => void;
  setDefaultAnchorMode: (mode: AnnotationAnchorMode) => void;
  updateDefaultStyle: (patch: Partial<AnnotationStyle>) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  activeTool: 'move',
  defaultAnchorMode: 'canvas',
  defaultStyle: { ...DEFAULT_ANNOTATION_STYLE },
  setActiveTool: (tool) => set({ activeTool: tool }),
  setDefaultAnchorMode: (mode) => set({ defaultAnchorMode: mode }),
  updateDefaultStyle: (patch) =>
    set((state) => ({ defaultStyle: { ...state.defaultStyle, ...patch } })),
}));
