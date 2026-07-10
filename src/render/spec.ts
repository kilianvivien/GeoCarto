import type { BlendMode } from '@/project/cartoproj';

export interface RenderTransform {
  translate: { x: number; y: number };
  rotate: number;
  scale: number;
}

export type RenderNode =
  | { kind: 'fragment'; markup: string }
  | {
      kind: 'group';
      id: string;
      transform: RenderTransform;
      opacity: number;
      blendMode: BlendMode;
      children: RenderNode[];
    };

export interface RenderScene {
  width: number;
  height: number;
  nodes: RenderNode[];
}
