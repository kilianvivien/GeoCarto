import Konva from 'konva';
import type maplibregl from 'maplibre-gl';
import type { Annotation, PinIcon } from '@/project/cartoproj';
import { hatchLines, strokeDash } from '@/style/annotationPatterns';

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

function haversineMeters(a: [number, number], b: [number, number]) {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function formatMeasurement(annotation: Extract<Annotation, { kind: 'measurement' }>) {
  const length = annotation.geoPoints.slice(1).reduce((sum, point, index) => {
    const previous = annotation.geoPoints[index];
    return sum + haversineMeters(previous, point);
  }, 0);
  if (annotation.unitSystem === 'imperial') {
    const feet = length * 3.28084;
    return feet >= 5280 ? `${(feet / 5280).toFixed(2)} mi` : `${Math.round(feet)} ft`;
  }
  return length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`;
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
  const commonFill = {
    fill: style.fillColor,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: strokeDash(style),
  };

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
      addHatch(group, annotation, 'rectangle', { width: annotation.width, height: annotation.height });
      break;
    case 'ellipse':
      group.add(new Konva.Ellipse({ ...commonFill, radiusX: annotation.radiusX, radiusY: annotation.radiusY }));
      addHatch(group, annotation, 'ellipse', {
        x: -annotation.radiusX,
        y: -annotation.radiusY,
        width: annotation.radiusX * 2,
        height: annotation.radiusY * 2,
      });
      break;
    case 'line':
      group.add(
        new Konva.Line({
          points: annotation.points,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
          dash: strokeDash(style),
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
          dash: strokeDash(style),
          pointerLength: 12,
          pointerWidth: 12,
          lineCap: 'round',
          lineJoin: 'round',
        }),
      );
      break;
    case 'polygon':
      group.add(new Konva.Line({ ...commonFill, points: annotation.points, closed: annotation.closed, lineJoin: 'round' }));
      addHatch(group, annotation, 'polygon', polygonLocalBounds(annotation.points), annotation.points);
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
    case 'measurement':
      group.add(
        new Konva.Line({
          points: annotation.points,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
          dash: strokeDash(style) ?? [6, 5],
          lineCap: 'round',
          lineJoin: 'round',
        }),
      );
      for (let index = 0; index < annotation.points.length; index += 2) {
        group.add(
          new Konva.Circle({
            x: annotation.points[index],
            y: annotation.points[index + 1],
            radius: 4,
            fill: '#ffffff',
            stroke: style.strokeColor,
            strokeWidth: 1.5,
          }),
        );
      }
      group.add(
        new Konva.Text({
          text: formatMeasurement(annotation),
          x: annotation.points.at(-2) ?? 0,
          y: (annotation.points.at(-1) ?? 0) + 10,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
          padding: 5,
        }),
      );
      break;
  }

  layer.add(group);
}

function addHatch(
  group: Konva.Group,
  annotation: Annotation,
  kind: 'rectangle' | 'ellipse' | 'polygon',
  bounds: { x?: number; y?: number; width: number; height: number },
  points?: number[],
): void {
  if (annotation.style.fillPattern === 'none') return;
  const x = bounds.x ?? 0;
  const y = bounds.y ?? 0;
  const hatch = new Konva.Group({
    x,
    y,
    clipFunc: (ctx) => {
      if (kind === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(bounds.width / 2, bounds.height / 2, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2);
        ctx.closePath();
        return;
      }
      if (kind === 'polygon' && points) {
        ctx.beginPath();
        ctx.moveTo(points[0] - x, points[1] - y);
        for (let index = 2; index < points.length; index += 2) {
          ctx.lineTo(points[index] - x, points[index + 1] - y);
        }
        ctx.closePath();
        return;
      }
      ctx.rect(0, 0, bounds.width, bounds.height);
    },
  });
  for (const line of hatchLines(bounds.width, bounds.height, annotation.style.fillPattern, annotation.style.hatchSpacing)) {
    hatch.add(
      new Konva.Line({
        points: line.points,
        stroke: annotation.style.hatchColor,
        strokeWidth: 1.25,
        lineCap: annotation.style.fillPattern === 'dots' ? 'round' : 'butt',
      }),
    );
  }
  group.add(hatch);
}

function polygonLocalBounds(points: number[]) {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
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
