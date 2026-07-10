import type { RenderNode, RenderScene } from './spec';

function number(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : '0';
}

export function renderNodeToSvg(node: RenderNode): string {
  if (node.kind === 'fragment') return node.markup;
  const { translate, rotate, scale } = node.transform;
  const transform = `translate(${number(translate.x)},${number(translate.y)}) rotate(${number(rotate)}) scale(${number(scale)})`;
  const blend = node.blendMode === 'normal' ? '' : ` style="mix-blend-mode:${node.blendMode}"`;
  return `<g transform="${transform}" data-render-node="${node.id}" opacity="${number(node.opacity)}"${blend}>${node.children.map(renderNodeToSvg).join('')}</g>`;
}

export function renderSceneToSvg(scene: RenderScene): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${number(scene.width)}" height="${number(scene.height)}" viewBox="0 0 ${number(scene.width)} ${number(scene.height)}">${scene.nodes.map(renderNodeToSvg).join('')}</svg>`;
}
