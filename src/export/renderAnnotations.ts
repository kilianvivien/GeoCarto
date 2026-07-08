import Konva from 'konva';
import type maplibregl from 'maplibre-gl';
import type { Annotation, AnnotationStyle, BrushPreset, LegendFillStyle, LegendSymbol, PinIcon } from '@/project/cartoproj';
import type { CanvasProjection } from '@/canvas/canvasProjection';
import { hatchLines, strokeDash } from '@/style/annotationPatterns';
import { legendEntrySymbol } from '@/style/legendSwatches';
import { metersPerPixel, niceScaleBar } from '@/style/furniture';
import { buildGraticule } from '@/projection/graticule';

function shadowProps(style: AnnotationStyle) {
  if (style.shadowBlur <= 0 && style.shadowOffsetX === 0 && style.shadowOffsetY === 0) {
    return {} as Record<string, never>;
  }
  return {
    shadowColor: style.shadowColor,
    shadowBlur: style.shadowBlur,
    shadowOffsetX: style.shadowOffsetX,
    shadowOffsetY: style.shadowOffsetY,
    shadowOpacity: 0.65,
  };
}

function blendOperation(style: AnnotationStyle): GlobalCompositeOperation | undefined {
  if (style.blendMode === 'normal') return undefined;
  return style.blendMode as GlobalCompositeOperation;
}

function brushStrokeProps(style: AnnotationStyle, preset: BrushPreset | undefined, opacity: number) {
  switch (preset ?? 'round') {
    case 'marker':
      return { strokeWidth: style.strokeWidth * 1.8, opacity: opacity * 0.78, dash: undefined };
    case 'pencil':
      return { strokeWidth: Math.max(1, style.strokeWidth * 0.9), opacity: opacity * 0.68, dash: [1, 5] };
    case 'highlighter':
      return { strokeWidth: style.strokeWidth * 3.5, opacity: opacity * 0.42, dash: undefined };
    case 'round':
      return { strokeWidth: style.strokeWidth, opacity, dash: strokeDash(style) };
  }
}

interface RenderOptions {
  width: number;
  height: number;
  annotations: Annotation[];
  /** Live editor map used to project geo-anchored annotations to editor canvas pixels. */
  map: maplibregl.Map | null;
  /** Coordinate bridge for the active engine — used instead of `map` for anchoring/graticule. */
  projection: CanvasProjection | null;
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

function legendSymbolDash(symbol: LegendSymbol): number[] | undefined {
  if (symbol.kind === 'fill' || symbol.kind === 'pin') return undefined;
  switch (symbol.strokePattern) {
    case 'dotted':
      return [1, Math.max(3, symbol.strokeWidth * 1.8)];
    case 'dashed':
      return [Math.max(4, symbol.strokeWidth * 3), Math.max(3, symbol.strokeWidth * 2)];
    case 'solid':
      return undefined;
  }
}

function legendSymbolStrokeWidth(symbol: LegendSymbol): number {
  if (symbol.kind === 'fill' || symbol.kind === 'pin') return 1;
  switch (symbol.brushPreset) {
    case 'marker':
      return symbol.strokeWidth * 1.8;
    case 'pencil':
      return Math.max(1, symbol.strokeWidth * 0.9);
    case 'highlighter':
      return symbol.strokeWidth * 3.5;
    case 'round':
    default:
      return symbol.strokeWidth;
  }
}

function legendSymbolOpacity(symbol: LegendSymbol): number {
  if (symbol.kind !== 'line') return 1;
  switch (symbol.brushPreset) {
    case 'marker':
      return 0.78;
    case 'pencil':
      return 0.68;
    case 'highlighter':
      return 0.42;
    default:
      return 1;
  }
}

function addLegendSwatch(group: Konva.Group, symbol: LegendSymbol, style: AnnotationStyle, x: number, y: number, size: number): void {
  if (symbol.kind !== 'fill') {
    const centerY = y + size / 2;
    const strokeWidth = legendSymbolStrokeWidth(symbol);
    const dash = legendSymbolDash(symbol);
    switch (symbol.kind) {
      case 'line':
        group.add(
          new Konva.Line({
            points: [x, centerY, x + size, centerY],
            stroke: symbol.strokeColor,
            strokeWidth,
            dash,
            lineCap: 'round',
            opacity: legendSymbolOpacity(symbol),
          }),
        );
        return;
      case 'arrow':
        group.add(
          new Konva.Arrow({
            points: [x, centerY, x + size, centerY],
            stroke: symbol.strokeColor,
            fill: symbol.strokeColor,
            strokeWidth,
            dash,
            pointerLength: Math.max(6, size * 0.34),
            pointerWidth: Math.max(6, size * 0.34),
            lineCap: 'round',
          }),
        );
        return;
      case 'measurement':
        group.add(
          new Konva.Line({
            points: [x, centerY, x + size, centerY],
            stroke: symbol.strokeColor,
            strokeWidth,
            dash: dash ?? [6, 5],
            lineCap: 'round',
          }),
        );
        group.add(new Konva.Circle({ x, y: centerY, radius: Math.max(2, size * 0.16), fill: '#ffffff', stroke: symbol.strokeColor, strokeWidth: 1.5 }));
        group.add(new Konva.Circle({ x: x + size, y: centerY, radius: Math.max(2, size * 0.16), fill: '#ffffff', stroke: symbol.strokeColor, strokeWidth: 1.5 }));
        return;
      case 'pin': {
        const pin = new Konva.Group({ x: x + size / 2, y: y + size / 2 });
        pinGlyph(pin, symbol.pinColor, symbol.pinIcon, size * 0.82);
        group.add(pin);
        return;
      }
    }
  }
  const fill: LegendFillStyle = {
    fillColor: symbol.fillColor,
    fillPattern: symbol.fillPattern,
    hatchColor: symbol.hatchColor,
    hatchSpacing: symbol.hatchSpacing,
  };
  group.add(
    new Konva.Rect({
      x,
      y,
      width: size,
      height: size,
      fill: fill.fillColor,
      cornerRadius: 3,
      stroke: style.strokeColor,
      strokeWidth: 0.5,
    }),
  );
  if (fill.fillPattern === 'none') return;
  const hatch = new Konva.Group({
    x,
    y,
    clipFunc: (ctx) => {
      ctx.rect(0, 0, size, size);
    },
  });
  for (const line of hatchLines(size, size, fill.fillPattern, fill.hatchSpacing)) {
    hatch.add(
      new Konva.Line({
        points: line.points,
        stroke: fill.hatchColor,
        strokeWidth: 1.25,
        lineCap: fill.fillPattern === 'dots' ? 'round' : 'butt',
      }),
    );
  }
  group.add(hatch);
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

function addAnnotation(
  layer: Konva.Layer,
  annotation: Annotation,
  originPx: { x: number; y: number },
  map: maplibregl.Map | null,
  projection: CanvasProjection | null,
): void {
  if (!annotation.visible) return;

  const blend = blendOperation(annotation.style);
  const group = new Konva.Group({
    x: originPx.x,
    y: originPx.y,
    rotation: annotation.rotation,
    opacity: annotation.opacity,
    ...(blend ? { globalCompositeOperation: blend } : {}),
  });

  const { style } = annotation;
  const shadow = shadowProps(style);
  const haloWidth = style.haloWidth;
  const haloColor = style.haloColor;
  const haloStrokeWidth = style.strokeWidth + haloWidth * 2;
  const commonFill = {
    fill: style.fillColor,
    stroke: style.strokeColor,
    strokeWidth: style.strokeWidth,
    dash: strokeDash(style),
    ...shadow,
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
      if (haloWidth > 0) {
        group.add(
          new Konva.Rect({
            width: annotation.width,
            height: annotation.height,
            cornerRadius: annotation.cornerRadius,
            fill: haloColor,
            stroke: haloColor,
            strokeWidth: haloStrokeWidth,
          }),
        );
      }
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
      if (haloWidth > 0) {
        group.add(
          new Konva.Ellipse({
            radiusX: annotation.radiusX + haloWidth,
            radiusY: annotation.radiusY + haloWidth,
            fill: haloColor,
            stroke: haloColor,
            strokeWidth: haloStrokeWidth,
          }),
        );
      }
      group.add(new Konva.Ellipse({ ...commonFill, radiusX: annotation.radiusX, radiusY: annotation.radiusY }));
      addHatch(group, annotation, 'ellipse', {
        x: -annotation.radiusX,
        y: -annotation.radiusY,
        width: annotation.radiusX * 2,
        height: annotation.radiusY * 2,
      });
      break;
    case 'line':
      if (annotation.lineRole === 'brush') {
        const brush = brushStrokeProps(style, style.brushPreset, annotation.opacity);
        if (haloWidth > 0) {
          group.add(
            new Konva.Line({
              points: annotation.points,
              stroke: haloColor,
              strokeWidth: brush.strokeWidth + haloWidth * 2,
              lineCap: 'round',
              lineJoin: 'round',
              tension: 0.35,
            }),
          );
        }
        group.add(
          new Konva.Line({
            points: annotation.points,
            stroke: style.strokeColor,
            strokeWidth: brush.strokeWidth,
            opacity: brush.opacity,
            dash: brush.dash,
            lineCap: 'round',
            lineJoin: 'round',
            tension: 0.35,
            ...shadow,
          }),
        );
        break;
      }
      if (haloWidth > 0) {
        group.add(
          new Konva.Line({
            points: annotation.points,
            stroke: haloColor,
            strokeWidth: haloStrokeWidth,
            lineCap: 'round',
            lineJoin: 'round',
          }),
        );
      }
      group.add(
        new Konva.Line({
          points: annotation.points,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
          dash: strokeDash(style),
          lineCap: 'round',
          lineJoin: 'round',
          tension: annotation.points.length > 4 ? 0.35 : 0,
          ...shadow,
        }),
      );
      break;
    case 'arrow':
      if (haloWidth > 0) {
        group.add(
          new Konva.Arrow({
            points: annotation.points,
            stroke: haloColor,
            fill: haloColor,
            strokeWidth: haloStrokeWidth,
            pointerLength: 12 + haloWidth,
            pointerWidth: 12 + haloWidth,
            lineCap: 'round',
            lineJoin: 'round',
          }),
        );
      }
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
          ...shadow,
        }),
      );
      break;
    case 'polygon':
      if (haloWidth > 0) {
        group.add(
          new Konva.Line({
            points: annotation.points,
            closed: annotation.closed,
            fill: haloColor,
            stroke: haloColor,
            strokeWidth: haloStrokeWidth,
            lineJoin: 'round',
          }),
        );
      }
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
    case 'image': {
      if (annotation.src) {
        const img = new window.Image();
        img.src = annotation.src;
        // Synchronous: if the image isn't decoded yet, Konva will simply paint
        // an empty rect — exports are triggered after the live stage has loaded
        // it, so caches are usually warm.
        group.add(
          new Konva.Image({
            image: img,
            width: annotation.width,
            height: annotation.height,
            ...shadow,
          }),
        );
      }
      break;
    }
    case 'legend': {
      const padding = 10;
      const rowHeight = style.textSize + 8;
      const swatchSize = style.textSize;
      const visibleEntries = annotation.entries.filter((entry) => entry.visible);
      const height = padding * 2 + (style.textSize + 6) + rowHeight * visibleEntries.length;
      group.add(
        new Konva.Rect({
          width: annotation.width,
          height,
          fill: style.fillColor,
          cornerRadius: 10,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
          ...shadow,
        }),
      );
      group.add(
        new Konva.Text({
          text: annotation.title,
          x: padding,
          y: padding,
          fontSize: style.textSize + 2,
          fontFamily: style.fontFamily,
          fontStyle: 'bold',
          fill: style.textColor,
        }),
      );
      visibleEntries.forEach((entry, index) => {
        const y = padding + (style.textSize + 6) + index * rowHeight;
        addLegendSwatch(group, legendEntrySymbol(entry), style, padding, y, swatchSize);
        group.add(
          new Konva.Text({
            text: entry.label,
            x: padding + swatchSize + 8,
            y: y + 1,
            fontSize: style.textSize,
            fontFamily: style.fontFamily,
            fill: style.textColor,
          }),
        );
      });
      break;
    }
    case 'comment': {
      const width = 28;
      const height = 22;
      group.add(
        new Konva.Rect({
          x: -width / 2,
          y: -height - 5,
          width,
          height,
          cornerRadius: 7,
          fill: style.pinColor,
          stroke: '#ffffff',
          strokeWidth: 2,
          shadowColor: 'rgba(0,0,0,0.24)',
          shadowBlur: 6,
        }),
      );
      group.add(
        new Konva.Line({
          points: [-5, -6, 0, 0, 5, -6],
          closed: true,
          fill: style.pinColor,
          stroke: '#ffffff',
          strokeWidth: 2,
          lineJoin: 'round',
        }),
      );
      group.add(
        new Konva.Line({
          points: [-7, -20, 7, -20],
          stroke: '#ffffff',
          strokeWidth: 2,
          lineCap: 'round',
        }),
      );
      group.add(
        new Konva.Line({
          points: [-7, -14, 3, -14],
          stroke: '#ffffff',
          strokeWidth: 2,
          lineCap: 'round',
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
    case 'titleblock': {
      const titleSize = style.textSize + 8;
      group.add(
        new Konva.Text({
          text: annotation.title,
          width: annotation.width,
          fill: style.textColor,
          fontSize: titleSize,
          fontFamily: style.fontFamily,
          fontStyle: 'bold',
        }),
      );
      if (annotation.subtitle.trim() !== '') {
        group.add(
          new Konva.Text({
            text: annotation.subtitle,
            y: titleSize + 6,
            width: annotation.width,
            fill: style.textColor,
            fontSize: style.textSize,
            fontFamily: style.fontFamily,
            opacity: 0.75,
          }),
        );
      }
      break;
    }
    case 'sourcecredit':
      group.add(
        new Konva.Text({
          text: annotation.text,
          width: annotation.width,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
          opacity: 0.85,
        }),
      );
      break;
    case 'scalebar': {
      const tick = map
        ? niceScaleBar(metersPerPixel(map), annotation.maxWidth, annotation.unitSystem)
        : { lengthPx: annotation.maxWidth, label: '—' };
      const barHeight = 6;
      const length = Math.max(1, tick.lengthPx);
      const stroke = Math.max(1, style.strokeWidth);
      group.add(new Konva.Line({ points: [0, 0, 0, barHeight, length, barHeight, length, 0], stroke: style.strokeColor, strokeWidth: stroke }));
      group.add(new Konva.Rect({ x: 0, y: 0, width: length / 2, height: barHeight, fill: style.strokeColor }));
      group.add(
        new Konva.Text({
          text: tick.label,
          y: barHeight + 3,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
        }),
      );
      break;
    }
    case 'northarrow': {
      const bearing = map ? map.getBearing() : 0;
      const r = annotation.size / 2;
      const inner = new Konva.Group({ x: r, y: r, rotation: -bearing });
      inner.add(
        new Konva.Line({
          points: [0, -r, r * 0.5, r * 0.7, 0, r * 0.32, -r * 0.5, r * 0.7],
          closed: true,
          fill: style.strokeColor,
          stroke: style.strokeColor,
          strokeWidth: 1,
          lineJoin: 'round',
        }),
      );
      inner.add(
        new Konva.Text({
          text: 'N',
          x: -style.textSize / 2,
          y: -r - style.textSize - 2,
          fill: style.textColor,
          fontSize: style.textSize,
          fontFamily: style.fontFamily,
          fontStyle: 'bold',
        }),
      );
      group.add(inner);
      break;
    }
    case 'graticule': {
      if (!projection) break;
      const multiline = buildGraticule(annotation.intervalDeg);
      for (const line of multiline.coordinates) {
        const projected = line
          .map((lngLat) => projection.project(lngLat as [number, number]))
          .filter((p): p is { x: number; y: number } => p !== null);
        if (projected.length < 2) continue;
        group.add(
          new Konva.Line({
            points: projected.flatMap((p) => [p.x, p.y]),
            stroke: style.strokeColor,
            strokeWidth: style.strokeWidth,
            dash: strokeDash(style),
            listening: false,
          }),
        );
      }
      break;
    }
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
  const { width, height, annotations, map, projection, frameOffset, scale } = options;

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
      const projected =
        annotation.anchorMode === 'map' && annotation.geoAnchor && projection
          ? projection.project(annotation.geoAnchor)
          : null;
      const editorPos = projected ?? annotation.position;
      addAnnotation(layer, annotation, { x: editorPos.x, y: editorPos.y }, map, projection);
    }

    layer.draw();
    const canvas = stage.toCanvas();
    stage.destroy();
    return canvas;
  } finally {
    container.remove();
  }
}
