import Konva from 'konva';
import type maplibregl from 'maplibre-gl';
import type { Annotation, PinIcon } from '@/project/cartoproj';

interface RenderOptions {
  width: number;
  height: number;
  annotations: Annotation[];
  /** Live editor map used to project geo-anchored annotations to editor canvas pixels. */
  map: maplibregl.Map | null;
  /** Inset of the frame box on the editor canvas. */
  frameOffset: { x: number; y: number };
  /** Pixel scale from editor canvas to output canvas. */
  scale: number;
}

function starPoints(radius: number): number[] {
  const points: number[] = [];
  const inner = radius * 0.45;
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : inner;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return points;
}

function pinGlyph(group: Konva.Group, color: string, icon: PinIcon, size: number): void {
  const radius = size / 2;
  const stroke = '#ffffff';
  const shadow = { shadowColor: 'rgba(0,0,0,0.24)', shadowBlur: 8 };
  switch (icon) {
    case 'dot':
      group.add(new Konva.Circle({ radius, fill: color, stroke, strokeWidth: 2, ...shadow }));
      break;
    case 'ring':
      group.add(new Konva.Circle({ radius, fill: 'transparent', stroke: color, strokeWidth: 4, ...shadow }));
      break;
    case 'flag': {
      const inner = new Konva.Group(shadow);
      inner.add(new Konva.Line({ points: [0, -radius, 0, radius], stroke, strokeWidth: 3, lineCap: 'round' }));
      inner.add(
        new Konva.Line({
          points: [0, -radius, radius * 0.95, -radius * 0.68, 0, -radius * 0.34],
          fill: color,
          stroke,
          strokeWidth: 1.5,
          closed: true,
          lineJoin: 'round',
        }),
      );
      group.add(inner);
      break;
    }
    case 'star':
      group.add(
        new Konva.Line({
          points: starPoints(radius),
          fill: color,
          stroke,
          strokeWidth: 1.5,
          closed: true,
          ...shadow,
        }),
      );
      break;
    case 'triangle':
      group.add(
        new Konva.Line({
          points: [0, -radius, radius, radius * 0.8, -radius, radius * 0.8],
          fill: color,
          stroke,
          strokeWidth: 1.5,
          closed: true,
          lineJoin: 'round',
          ...shadow,
        }),
      );
      break;
    case 'square':
      group.add(
        new Konva.Rect({
          x: -radius,
          y: -radius,
          width: size,
          height: size,
          cornerRadius: 4,
          fill: color,
          stroke,
          strokeWidth: 1.5,
          ...shadow,
        }),
      );
      break;
    case 'diamond':
      group.add(
        new Konva.Rect({
          x: -radius * 0.72,
          y: -radius * 0.72,
          width: radius * 1.44,
          height: radius * 1.44,
          rotation: 45,
          fill: color,
          stroke,
          strokeWidth: 1.5,
          ...shadow,
        }),
      );
      break;
    case 'cross': {
      const inner = new Konva.Group(shadow);
      inner.add(new Konva.Circle({ radius, fill: color, stroke, strokeWidth: 1.5 }));
      inner.add(new Konva.Line({ points: [-radius * 0.55, 0, radius * 0.55, 0], stroke, strokeWidth: 3, lineCap: 'round' }));
      inner.add(new Konva.Line({ points: [0, -radius * 0.55, 0, radius * 0.55], stroke, strokeWidth: 3, lineCap: 'round' }));
      group.add(inner);
      break;
    }
    case 'target': {
      const inner = new Konva.Group(shadow);
      inner.add(new Konva.Circle({ radius, fill: color, stroke, strokeWidth: 1.5 }));
      inner.add(new Konva.Circle({ radius: radius * 0.55, fill: 'transparent', stroke, strokeWidth: 2 }));
      inner.add(new Konva.Circle({ radius: radius * 0.16, fill: stroke }));
      group.add(inner);
      break;
    }
  }
}

function addAnnotation(layer: Konva.Layer, annotation: Annotation, originPx: { x: number; y: number }): void {
  if (!annotation.visible) return;

  const group = new Konva.Group({
    x: originPx.x,
    y: originPx.y,
    rotation: annotation.rotation,
    opacity: annotation.opacity,
  });

  const { style } = annotation;
  const commonFill = { fill: style.fillColor, stroke: style.strokeColor, strokeWidth: style.strokeWidth };

  switch (annotation.kind) {
    case 'text':
      group.add(
        new Konva.Text({
          text: annotation.text,
          width: annotation.width,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
          padding: 8,
        }),
      );
      break;
    case 'rectangle':
      group.add(
        new Konva.Rect({
          ...commonFill,
          width: annotation.width,
          height: annotation.height,
          cornerRadius: annotation.cornerRadius,
        }),
      );
      break;
    case 'ellipse':
      group.add(new Konva.Ellipse({ ...commonFill, radiusX: annotation.radiusX, radiusY: annotation.radiusY }));
      break;
    case 'line':
      group.add(
        new Konva.Line({
          points: annotation.points,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
        }),
      );
      break;
    case 'arrow':
      group.add(
        new Konva.Arrow({
          points: annotation.points,
          stroke: style.strokeColor,
          fill: style.strokeColor,
          strokeWidth: style.strokeWidth,
          pointerLength: 12,
          pointerWidth: 12,
          lineCap: 'round',
          lineJoin: 'round',
        }),
      );
      break;
    case 'polygon':
      group.add(new Konva.Line({ ...commonFill, points: annotation.points, closed: annotation.closed, lineJoin: 'round' }));
      break;
    case 'pin': {
      pinGlyph(group, style.pinColor, style.pinIcon, annotation.size);
      group.add(
        new Konva.Text({
          text: annotation.label,
          x: annotation.size * 0.65,
          y: -annotation.size / 2,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
          padding: 4,
        }),
      );
      break;
    }
  }

  layer.add(group);
}

/**
 * Render the document's annotations to an offscreen canvas matching the output
 * pixel dimensions. Geo-anchored annotations are projected through the *live*
 * editor map; canvas-anchored use their stored editor-canvas position. Both
 * paths share the same editor-canvas→output transform.
 */
export function renderAnnotationsToCanvas(options: RenderOptions): HTMLCanvasElement {
  const { width, height, annotations, map, frameOffset, scale } = options;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(container);

  try {
    const stage = new Konva.Stage({ container, width, height });
    const layer = new Konva.Layer();
    layer.scale({ x: scale, y: scale });
    layer.position({ x: -frameOffset.x * scale, y: -frameOffset.y * scale });
    stage.add(layer);

    for (const annotation of annotations) {
      const editorPos =
        annotation.anchorMode === 'map' && annotation.geoAnchor && map
          ? map.project(annotation.geoAnchor)
          : annotation.position;
      addAnnotation(layer, annotation, { x: editorPos.x, y: editorPos.y });
    }

    layer.draw();
    const canvas = stage.toCanvas();
    stage.destroy();
    return canvas;
  } finally {
    container.remove();
  }
}
