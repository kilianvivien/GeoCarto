import { describe, expect, it } from 'vitest';
import { renderSceneToSvg } from './svgBackend';

describe('SVG render backend', () => {
  it('renders typed scene groups with transforms, opacity, and blend modes', () => {
    const svg = renderSceneToSvg({
      width: 100,
      height: 80,
      nodes: [{
        kind: 'group',
        id: 'shape-1',
        transform: { translate: { x: 10, y: 20 }, rotate: 15, scale: 2 },
        opacity: 0.75,
        blendMode: 'multiply',
        children: [{ kind: 'fragment', markup: '<rect width="10" height="10"/>' }],
      }],
    });
    expect(svg).toContain('data-render-node="shape-1"');
    expect(svg).toContain('translate(10,20) rotate(15) scale(2)');
    expect(svg).toContain('mix-blend-mode:multiply');
  });
});
