import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Arrow,
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type maplibregl from 'maplibre-gl';
import type {
  Annotation,
  BrushPreset,
  AnnotationStyle,
  CommentAnnotation,
  ImageAnnotation,
  LegendAnnotation,
  PinAnnotation,
  PinIcon,
  TextAnnotation,
} from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore, toolToAnnotationKind } from '@/state/toolStore';
import { useViewportStore } from '@/state/viewportStore';
import { hatchLines, strokeDash } from '@/style/annotationPatterns';
import { createAnnotation } from '@/tools/annotationFactory';
import { applyAnnotationTransform } from '@/tools/annotationTransforms';
import { useMapInstance } from './mapInstance';

function useStageSize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resize = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}

function anchorPosition(annotation: Annotation, map: maplibregl.Map | null) {
  if (annotation.anchorMode === 'map' && annotation.geoAnchor && map) {
    const point = map.project(annotation.geoAnchor);
    return { x: point.x, y: point.y };
  }
  return annotation.position;
}

function pointerGeo(map: maplibregl.Map | null, point: { x: number; y: number }) {
  if (!map) return null;
  const lngLat = map.unproject([point.x, point.y]);
  return [lngLat.lng, lngLat.lat] as [number, number];
}

function snapToGrid(point: { x: number; y: number }, enabled: boolean, spacing: number) {
  if (!enabled) return point;
  return {
    x: Math.round(point.x / spacing) * spacing,
    y: Math.round(point.y / spacing) * spacing,
  };
}

function normalizeDragPosition(annotation: Annotation, map: maplibregl.Map | null, position: { x: number; y: number }) {
  if (annotation.anchorMode === 'map') {
    return { position, geoAnchor: pointerGeo(map, position) };
  }
  return { position, geoAnchor: annotation.geoAnchor };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function blurFocusedControl() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

interface PickedImage {
  dataUrl: string;
  width: number;
  height: number;
}

interface FreehandDraft {
  position: { x: number; y: number };
  geoAnchor: [number, number] | null;
  points: number[];
}

/** Prompt the user for an image file, read it as a data URL, and return its natural pixel size. */
function pickImageFile(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = () => rej(reader.error);
        reader.readAsDataURL(file);
      });
      const img = new window.Image();
      img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    // No cancel signal exists for file pickers — if the user dismisses, resolve never fires;
    // that's fine because the tool stays active until the next interaction.
    input.click();
  });
}

function shadowProps(style: AnnotationStyle) {
  if (style.shadowBlur <= 0 && style.shadowOffsetX === 0 && style.shadowOffsetY === 0) {
    return undefined;
  }
  return {
    shadowColor: style.shadowColor,
    shadowBlur: style.shadowBlur,
    shadowOffsetX: style.shadowOffsetX,
    shadowOffsetY: style.shadowOffsetY,
    shadowOpacity: 0.65,
  };
}

function blendOperation(style: AnnotationStyle) {
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

function FillShape({
  annotation,
  editing,
}: {
  annotation: Annotation;
  editing?: boolean;
}) {
  const shadow = shadowProps(annotation.style);
  const common = {
    opacity: annotation.opacity,
    fill: annotation.style.fillColor,
    stroke: annotation.style.strokeColor,
    strokeWidth: annotation.style.strokeWidth,
    dash: strokeDash(annotation.style),
    ...(shadow ?? {}),
  };
  const haloWidth = annotation.style.haloWidth;
  const haloColor = annotation.style.haloColor;
  const haloStrokeWidth = annotation.style.strokeWidth + haloWidth * 2;

  switch (annotation.kind) {
    case 'text':
      return (
        <Text
          text={annotation.text}
          width={annotation.width}
          fill={editing ? 'transparent' : annotation.style.textColor}
          fontSize={annotation.style.textSize}
          fontFamily={annotation.style.fontFamily}
          padding={8}
        />
      );
    case 'rectangle':
      return (
        <>
          {haloWidth > 0 && (
            <Rect
              width={annotation.width}
              height={annotation.height}
              cornerRadius={annotation.cornerRadius}
              fill={haloColor}
              stroke={haloColor}
              strokeWidth={haloStrokeWidth}
              opacity={annotation.opacity}
              listening={false}
            />
          )}
          <Rect {...common} width={annotation.width} height={annotation.height} cornerRadius={annotation.cornerRadius} />
          <HatchOverlay kind="rectangle" width={annotation.width} height={annotation.height} annotation={annotation} />
        </>
      );
    case 'ellipse':
      return (
        <>
          {haloWidth > 0 && (
            <Ellipse
              radiusX={annotation.radiusX + haloWidth}
              radiusY={annotation.radiusY + haloWidth}
              fill={haloColor}
              stroke={haloColor}
              strokeWidth={haloStrokeWidth}
              opacity={annotation.opacity}
              listening={false}
            />
          )}
          <Ellipse {...common} radiusX={annotation.radiusX} radiusY={annotation.radiusY} />
          <HatchOverlay
            kind="ellipse"
            width={annotation.radiusX * 2}
            height={annotation.radiusY * 2}
            offset={{ x: -annotation.radiusX, y: -annotation.radiusY }}
            annotation={annotation}
          />
        </>
      );
    case 'line':
      if (annotation.lineRole === 'brush') {
        const brush = brushStrokeProps(annotation.style, annotation.style.brushPreset, annotation.opacity);
        return (
          <>
            <LineSelectionBounds points={annotation.points} strokeWidth={brush.strokeWidth} />
            {haloWidth > 0 && (
              <Line
                points={annotation.points}
                stroke={haloColor}
                strokeWidth={brush.strokeWidth + haloWidth * 2}
                opacity={annotation.opacity}
                lineCap="round"
                lineJoin="round"
                tension={0.35}
                listening={false}
              />
            )}
            <Line
              points={annotation.points}
              opacity={brush.opacity}
              stroke={annotation.style.strokeColor}
              strokeWidth={brush.strokeWidth}
              dash={brush.dash}
              lineCap="round"
              lineJoin="round"
              tension={0.35}
              {...(shadow ?? {})}
            />
          </>
        );
      }
      return (
        <>
          <LineSelectionBounds points={annotation.points} strokeWidth={annotation.style.strokeWidth} />
          {haloWidth > 0 && (
            <Line
              points={annotation.points}
              stroke={haloColor}
              strokeWidth={haloStrokeWidth}
              opacity={annotation.opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}
          <Line
            points={annotation.points}
            opacity={annotation.opacity}
            stroke={annotation.style.strokeColor}
            strokeWidth={annotation.style.strokeWidth}
            dash={strokeDash(annotation.style)}
            lineCap="round"
            lineJoin="round"
            tension={annotation.points.length > 4 ? 0.35 : 0}
            {...(shadow ?? {})}
          />
        </>
      );
    case 'arrow':
      return (
        <>
          <LineSelectionBounds points={annotation.points} strokeWidth={annotation.style.strokeWidth} />
          {haloWidth > 0 && (
            <Arrow
              points={annotation.points}
              stroke={haloColor}
              fill={haloColor}
              strokeWidth={haloStrokeWidth}
              pointerLength={12 + haloWidth}
              pointerWidth={12 + haloWidth}
              opacity={annotation.opacity}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}
          <Arrow
            points={annotation.points}
            opacity={annotation.opacity}
            stroke={annotation.style.strokeColor}
            fill={annotation.style.strokeColor}
            strokeWidth={annotation.style.strokeWidth}
            dash={strokeDash(annotation.style)}
            pointerLength={12}
            pointerWidth={12}
            lineCap="round"
            lineJoin="round"
            {...(shadow ?? {})}
          />
        </>
      );
    case 'polygon':
      return (
        <>
          {haloWidth > 0 && (
            <Line
              points={annotation.points}
              closed={annotation.closed}
              fill={haloColor}
              stroke={haloColor}
              strokeWidth={haloStrokeWidth}
              lineJoin="round"
              opacity={annotation.opacity}
              listening={false}
            />
          )}
          <Line {...common} points={annotation.points} closed={annotation.closed} lineJoin="round" />
          <HatchOverlay kind="polygon" points={annotation.points} annotation={annotation} />
        </>
      );
    case 'pin':
      return (
        <>
          <PinGlyph
            color={annotation.style.pinColor}
            icon={annotation.style.pinIcon}
            size={annotation.size}
          />
          <Text
            text={annotation.label}
            x={annotation.size * 0.65}
            y={-annotation.size / 2}
            fill={editing ? 'transparent' : annotation.style.textColor}
            fontSize={annotation.style.textSize}
            fontFamily={annotation.style.fontFamily}
            padding={4}
          />
        </>
      );
    case 'measurement':
      return (
        <>
          <LineSelectionBounds points={annotation.points} strokeWidth={annotation.style.strokeWidth} />
          <Line
            points={annotation.points}
            opacity={annotation.opacity}
            stroke={annotation.style.strokeColor}
            strokeWidth={annotation.style.strokeWidth}
            lineCap="round"
            lineJoin="round"
            dash={strokeDash(annotation.style) ?? [6, 5]}
          />
          {annotation.points.map((value, index) =>
            index % 2 === 0 ? (
              <Circle
                key={`${index}-${value}`}
                x={annotation.points[index]}
                y={annotation.points[index + 1]}
                radius={4}
                fill="#ffffff"
                stroke={annotation.style.strokeColor}
                strokeWidth={1.5}
              />
            ) : null,
          )}
          <Text
            text={formatMeasurement(annotation)}
            x={annotation.points.at(-2) ?? 0}
            y={(annotation.points.at(-1) ?? 0) + 10}
            fill={editing ? 'transparent' : annotation.style.textColor}
            fontSize={annotation.style.textSize}
            fontFamily={annotation.style.fontFamily}
            padding={5}
          />
        </>
      );
    case 'image':
      return <ImageShape annotation={annotation} />;
    case 'legend':
      return <LegendShape annotation={annotation} />;
    case 'comment':
      return <CommentShape annotation={annotation} />;
  }
}

function ImageShape({ annotation }: { annotation: ImageAnnotation }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!annotation.src) {
      setImg(null);
      return;
    }
    const next = new window.Image();
    next.onload = () => setImg(next);
    next.src = annotation.src;
  }, [annotation.src]);
  const shadow = shadowProps(annotation.style);
  if (!img) {
    return (
      <Rect
        width={annotation.width}
        height={annotation.height}
        fill={annotation.style.fillColor}
        opacity={0.25}
        dash={[6, 4]}
        stroke={annotation.style.strokeColor}
        strokeWidth={1}
      />
    );
  }
  return (
    <KonvaImage
      image={img}
      width={annotation.width}
      height={annotation.height}
      opacity={annotation.opacity}
      {...(shadow ?? {})}
    />
  );
}

function LegendShape({ annotation }: { annotation: LegendAnnotation }) {
  const padding = 10;
  const rowHeight = annotation.style.textSize + 8;
  const swatchSize = annotation.style.textSize;
  const visibleEntries = annotation.entries.filter((entry) => entry.visible);
  const height = padding * 2 + (annotation.style.textSize + 6) + rowHeight * visibleEntries.length;
  const shadow = shadowProps(annotation.style);
  return (
    <>
      <Rect
        width={annotation.width}
        height={height}
        fill={annotation.style.fillColor}
        cornerRadius={10}
        stroke={annotation.style.strokeColor}
        strokeWidth={annotation.style.strokeWidth}
        opacity={annotation.opacity}
        {...(shadow ?? {})}
      />
      <Text
        text={annotation.title}
        x={padding}
        y={padding}
        fontSize={annotation.style.textSize + 2}
        fontFamily={annotation.style.fontFamily}
        fontStyle="bold"
        fill={annotation.style.textColor}
      />
      {visibleEntries.map((entry, index) => {
        const y = padding + (annotation.style.textSize + 6) + index * rowHeight;
        return (
          <Group key={`${entry.label}-${index}`} y={y}>
            <Rect
              x={padding}
              width={swatchSize}
              height={swatchSize}
              fill={entry.swatchColor}
              cornerRadius={3}
              stroke={annotation.style.strokeColor}
              strokeWidth={0.5}
            />
            <Text
              text={entry.label}
              x={padding + swatchSize + 8}
              y={1}
              fontSize={annotation.style.textSize}
              fontFamily={annotation.style.fontFamily}
              fill={annotation.style.textColor}
            />
          </Group>
        );
      })}
    </>
  );
}

function CommentShape({ annotation }: { annotation: CommentAnnotation }) {
  const shadow = shadowProps(annotation.style);
  const width = 28;
  const height = 22;
  return (
    <Group>
      <Rect
        x={-width / 2}
        y={-height - 5}
        width={width}
        height={height}
        cornerRadius={7}
        fill={annotation.style.pinColor}
        stroke="#ffffff"
        strokeWidth={2}
        {...(shadow ?? {})}
      />
      <Line
        points={[-5, -6, 0, 0, 5, -6]}
        closed
        fill={annotation.style.pinColor}
        stroke="#ffffff"
        strokeWidth={2}
        lineJoin="round"
      />
      <Line points={[-7, -20, 7, -20]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
      <Line points={[-7, -14, 3, -14]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
    </Group>
  );
}

function HatchOverlay({
  annotation,
  kind,
  width,
  height,
  offset = { x: 0, y: 0 },
  points,
}: {
  annotation: Annotation;
  kind: 'rectangle' | 'ellipse' | 'polygon';
  width?: number;
  height?: number;
  offset?: { x: number; y: number };
  points?: number[];
}) {
  if (annotation.style.fillPattern === 'none') return null;
  const bounds =
    kind === 'polygon' && points
      ? polygonLocalBounds(points)
      : { x: offset.x, y: offset.y, width: width ?? 0, height: height ?? 0 };
  const lines = hatchLines(bounds.width, bounds.height, annotation.style.fillPattern, annotation.style.hatchSpacing);
  return (
    <Group
      x={bounds.x}
      y={bounds.y}
      clipFunc={(ctx) => {
        if (kind === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(bounds.width / 2, bounds.height / 2, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2);
          ctx.closePath();
          return;
        }
        if (kind === 'polygon' && points) {
          ctx.beginPath();
          ctx.moveTo(points[0] - bounds.x, points[1] - bounds.y);
          for (let index = 2; index < points.length; index += 2) {
            ctx.lineTo(points[index] - bounds.x, points[index + 1] - bounds.y);
          }
          ctx.closePath();
          return;
        }
        ctx.rect(0, 0, bounds.width, bounds.height);
      }}
      listening={false}
    >
      {lines.map((line, index) => (
        <Line
          key={index}
          points={line.points}
          stroke={annotation.style.hatchColor}
          strokeWidth={1.25}
          lineCap={annotation.style.fillPattern === 'dots' ? 'round' : 'butt'}
        />
      ))}
    </Group>
  );
}

function polygonLocalBounds(points: number[]) {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

function LineSelectionBounds({ points, strokeWidth }: { points: number[]; strokeWidth: number }) {
  const xs = points.filter((_, index) => index % 2 === 0);
  const ys = points.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padding = Math.max(10, strokeWidth / 2 + 8);

  return (
    <Rect
      x={minX}
      y={minY - padding}
      width={Math.max(1, maxX - minX)}
      height={Math.max(1, maxY - minY) + padding * 2}
      fill="rgba(0,0,0,0.001)"
    />
  );
}

function starPoints(radius: number) {
  const points: number[] = [];
  const inner = radius * 0.45;
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : inner;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return points;
}

function PinGlyph({ color, icon, size }: { color: string; icon: PinIcon; size: number }) {
  const radius = size / 2;
  const stroke = '#ffffff';
  const shadow = {
    shadowColor: 'rgba(0,0,0,0.24)',
    shadowBlur: 8,
  };

  switch (icon) {
    case 'dot':
      return <Circle radius={radius} fill={color} stroke={stroke} strokeWidth={2} {...shadow} />;
    case 'ring':
      return <Circle radius={radius} fill="transparent" stroke={color} strokeWidth={4} {...shadow} />;
    case 'flag':
      return (
        <Group {...shadow}>
          <Line points={[0, -radius, 0, radius]} stroke={stroke} strokeWidth={3} lineCap="round" />
          <Line
            points={[0, -radius, radius * 0.95, -radius * 0.68, 0, -radius * 0.34]}
            fill={color}
            stroke={stroke}
            strokeWidth={1.5}
            closed
            lineJoin="round"
          />
        </Group>
      );
    case 'star':
      return <Line points={starPoints(radius)} fill={color} stroke={stroke} strokeWidth={1.5} closed {...shadow} />;
    case 'triangle':
      return (
        <Line
          points={[0, -radius, radius, radius * 0.8, -radius, radius * 0.8]}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
          closed
          lineJoin="round"
          {...shadow}
        />
      );
    case 'square':
      return (
        <Rect
          x={-radius}
          y={-radius}
          width={size}
          height={size}
          cornerRadius={4}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
          {...shadow}
        />
      );
    case 'diamond':
      return (
        <Rect
          x={-radius * 0.72}
          y={-radius * 0.72}
          width={radius * 1.44}
          height={radius * 1.44}
          rotation={45}
          fill={color}
          stroke={stroke}
          strokeWidth={1.5}
          {...shadow}
        />
      );
    case 'cross':
      return (
        <Group {...shadow}>
          <Circle radius={radius} fill={color} stroke={stroke} strokeWidth={1.5} />
          <Line points={[-radius * 0.55, 0, radius * 0.55, 0]} stroke={stroke} strokeWidth={3} lineCap="round" />
          <Line points={[0, -radius * 0.55, 0, radius * 0.55]} stroke={stroke} strokeWidth={3} lineCap="round" />
        </Group>
      );
    case 'target':
      return (
        <Group {...shadow}>
          <Circle radius={radius} fill={color} stroke={stroke} strokeWidth={1.5} />
          <Circle radius={radius * 0.55} fill="transparent" stroke={stroke} strokeWidth={2} />
          <Circle radius={radius * 0.16} fill={stroke} />
        </Group>
      );
  }
}

function isStageTarget(event: KonvaEventObject<MouseEvent>) {
  return event.target === event.target.getStage() || event.target instanceof Konva.Layer;
}

function isLineLike(annotation: Annotation | undefined) {
  return annotation?.kind === 'line' || annotation?.kind === 'arrow' || annotation?.kind === 'measurement';
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function boundsFromAnnotation(annotation: Annotation, origin: { x: number; y: number }): Bounds {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x;
  let bottom = origin.y;
  if (annotation.kind === 'rectangle' || annotation.kind === 'text') {
    right += annotation.width;
    bottom += annotation.kind === 'rectangle' ? annotation.height : annotation.style.textSize + 24;
  } else if (annotation.kind === 'ellipse') {
    left -= annotation.radiusX;
    right += annotation.radiusX;
    top -= annotation.radiusY;
    bottom += annotation.radiusY;
  } else if (annotation.kind === 'pin') {
    left -= annotation.size / 2;
    right += annotation.size / 2 + annotation.label.length * annotation.style.textSize * 0.6;
    top -= annotation.size / 2;
    bottom += annotation.size / 2;
  } else if (annotation.kind === 'image' || annotation.kind === 'legend') {
    right += annotation.width;
    if (annotation.kind === 'image') {
      bottom += annotation.height;
    } else {
      // Estimate legend height the same way LegendShape lays it out.
      const rowHeight = annotation.style.textSize + 8;
      const padding = 10;
      const visibleEntries = annotation.entries.filter((entry) => entry.visible);
      bottom += padding * 2 + (annotation.style.textSize + 6) + rowHeight * visibleEntries.length;
    }
  } else if (annotation.kind === 'comment') {
    left -= 16;
    right += 16;
    top -= 30;
    bottom += 6;
  } else {
    const xs = annotation.points.filter((_, index) => index % 2 === 0).map((x) => x + origin.x);
    const ys = annotation.points.filter((_, index) => index % 2 === 1).map((y) => y + origin.y);
    left = Math.min(...xs);
    right = Math.max(...xs);
    top = Math.min(...ys);
    bottom = Math.max(...ys);
  }
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
}

function unionBounds(bounds: Bounds[]): Bounds | null {
  if (bounds.length === 0) return null;
  const left = Math.min(...bounds.map((item) => item.left));
  const right = Math.max(...bounds.map((item) => item.right));
  const top = Math.min(...bounds.map((item) => item.top));
  const bottom = Math.max(...bounds.map((item) => item.bottom));
  return { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
}

function boundsIntersect(a: Bounds, b: Bounds) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
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

function polygonAreaMeters(points: [number, number][]) {
  if (points.length < 3) return 0;
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += toRad(next[0] - current[0]) * (2 + Math.sin(toRad(current[1])) + Math.sin(toRad(next[1])));
  }
  return Math.abs((sum * radius * radius) / 2);
}

function formatMeasurement(annotation: Extract<Annotation, { kind: 'measurement' }>) {
  const length = annotation.geoPoints.slice(1).reduce((sum, point, index) => {
    const previous = annotation.geoPoints[index];
    return sum + haversineMeters(previous, point);
  }, 0);
  const area = polygonAreaMeters(annotation.geoPoints);
  if (annotation.unitSystem === 'imperial') {
    const feet = length * 3.28084;
    const areaFeet = area * 10.7639;
    const distance = feet >= 5280 ? `${(feet / 5280).toFixed(2)} mi` : `${Math.round(feet)} ft`;
    return annotation.geoPoints.length >= 3 && area > 0
      ? `${distance} · ${(areaFeet / 43560).toFixed(2)} ac`
      : distance;
  }
  const distance = length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`;
  return annotation.geoPoints.length >= 3 && area > 0
    ? `${distance} · ${(area / 1_000_000).toFixed(2)} km2`
    : distance;
}

function CommentPopover({ editorId, onClose }: { editorId: string; onClose: () => void }) {
  const annotation = useDocumentStore((s) =>
    s.project.annotations.find((item): item is CommentAnnotation => item.id === editorId && item.kind === 'comment'),
  );
  const map = useMapInstance((s) => s.map);
  const [draft, setDraft] = useState(annotation?.text ?? '');
  useEffect(() => setDraft(annotation?.text ?? ''), [annotation?.text]);
  if (!annotation) return null;
  const pos = anchorPosition(annotation, map);
  const commit = () => {
    useDocumentStore.getState().updateAnnotation(editorId, { text: draft } as Partial<Annotation>);
    onClose();
  };
  return (
    <div
      role="dialog"
      aria-label="Edit comment"
      className="absolute z-30 flex w-56 flex-col gap-1.5 rounded-[10px] border border-[var(--divider)] bg-[var(--glass-strong)] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.32)] backdrop-blur-xl"
      style={{ left: pos.x + 20, top: pos.y - 10 }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <textarea
        autoFocus
        value={draft}
        placeholder="Add a comment…"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            commit();
          }
        }}
        className="h-20 resize-none rounded-[7px] border border-[var(--divider)] bg-[var(--glass-thin)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent-ring)]"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[6px] px-2 py-1 text-[11px] text-[var(--text-2)] hover:bg-[var(--hover)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-[6px] bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-[var(--text-on-accent)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * Editable Konva annotation layer. It renders the canonical document annotations
 * and writes edits back to the document store.
 */
export function AnnotationStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Group>());
  const map = useMapInstance((s) => s.map);
  useViewportStore((s) => s.viewport);
  const annotations = useDocumentStore((s) => s.project.annotations);
  const annotationGroups = useDocumentStore((s) => s.project.annotationGroups);
  const selectedAnnotationId = useDocumentStore((s) => s.selectedAnnotationId);
  const selectedAnnotationIds = useDocumentStore((s) => s.selectedAnnotationIds);
  const mode = useDocumentStore((s) => s.project.mode);
  const { addAnnotation, moveAnnotations, selectAnnotation, setSelectedAnnotations, toggleAnnotationSelection, updateAnnotation } =
    useDocumentStore.getState();
  const activeTool = useToolStore((s) => s.activeTool);
  const defaultAnchorMode = useToolStore((s) => s.defaultAnchorMode);
  const defaultStyle = useToolStore((s) => s.defaultStyle);
  const gridSnapEnabled = useToolStore((s) => s.gridSnapEnabled);
  const gridSpacing = useToolStore((s) => s.gridSpacing);
  const smartGuidesEnabled = useToolStore((s) => s.smartGuidesEnabled);
  const size = useStageSize(containerRef);
  const [draftPolygon, setDraftPolygon] = useState<{
    position: { x: number; y: number };
    geoAnchor: [number, number] | null;
    points: number[];
    previewPoint: { x: number; y: number } | null;
  } | null>(null);
  const [draftArrow, setDraftArrow] = useState<{
    position: { x: number; y: number };
    geoAnchor: [number, number] | null;
    previewPoint: { x: number; y: number } | null;
  } | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [draftMeasurement, setDraftMeasurement] = useState<{
    position: { x: number; y: number };
    geoAnchor: [number, number] | null;
    points: number[];
    geoPoints: [number, number][];
    previewPoint: { x: number; y: number } | null;
  } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);
  const [paintDraft, setPaintDraft] = useState<FreehandDraft | null>(null);
  const [commentEditor, setCommentEditor] = useState<{ id: string } | null>(null);
  const paintPointerRef = useRef<number | null>(null);
  const paintDraftRef = useRef<FreehandDraft | null>(null);
  const marqueePointerRef = useRef<number | null>(null);
  const dragStartRef = useRef<Record<string, { x: number; y: number; geoAnchor: [number, number] | null }>>({});
  const lastMultiSelectionRef = useRef<string[]>([]);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);

  const capturesPointer =
    mode === 'editing' &&
    (activeTool === 'move' ||
      activeTool === 'marquee' ||
      activeTool === 'ruler' ||
      toolToAnnotationKind(activeTool) !== null);
  const selectedTextEditable = useMemo(
    () =>
      annotations.find(
        (annotation): annotation is TextAnnotation | PinAnnotation =>
          (annotation.kind === 'text' || annotation.kind === 'pin') &&
          annotation.id === selectedAnnotationId,
      ) ?? null,
    [annotations, selectedAnnotationId],
  );
  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId),
    [annotations, selectedAnnotationId],
  );
  const editingAnnotation =
    editingText &&
    selectedTextEditable?.id === editingText.id &&
    selectedTextEditable.visible &&
    !selectedTextEditable.locked
      ? selectedTextEditable
      : null;
  const editingPosition = editingAnnotation ? anchorPosition(editingAnnotation, map) : null;
  const editorMetrics = editingAnnotation
    ? editingAnnotation.kind === 'pin'
      ? {
          x: editingPosition ? editingPosition.x + editingAnnotation.size * 0.65 : 0,
          y: editingPosition ? editingPosition.y - editingAnnotation.size / 2 : 0,
          width: Math.max(120, editingAnnotation.label.length * editingAnnotation.style.textSize * 0.62),
        }
      : {
          x: editingPosition?.x ?? 0,
          y: editingPosition?.y ?? 0,
          width: editingAnnotation.width,
        }
    : null;

  const startTextEditing = useCallback((annotation: TextAnnotation | PinAnnotation) => {
    if (annotation.locked || !annotation.visible) return;
    selectAnnotation(annotation.id);
    useToolStore.getState().setActiveTool('move');
    setEditingText({
      id: annotation.id,
      value: annotation.kind === 'pin' ? annotation.label : annotation.text,
    });
  }, [selectAnnotation]);

  const commitTextEditing = useCallback(() => {
    if (!editingText) return;
    const nextText = editingText.value.trim() || 'Label';
    const annotation = useDocumentStore
      .getState()
      .project.annotations.find((item) => item.id === editingText.id);
    if (annotation?.kind === 'pin') {
      updateAnnotation(editingText.id, { label: nextText } as Partial<Annotation>);
    } else {
      updateAnnotation(editingText.id, { text: nextText } as Partial<Annotation>);
    }
    setEditingText(null);
  }, [editingText, updateAnnotation]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const selectedNodes = selectedAnnotationIds
      .map((id) => annotations.find((annotation) => annotation.id === id))
      .filter((annotation): annotation is Annotation => Boolean(annotation?.visible && !annotation.locked))
      .map((annotation) => nodeRefs.current.get(annotation.id))
      .filter((node): node is Konva.Group => Boolean(node));
    transformer.nodes(selectedNodes);
    transformer.getLayer()?.batchDraw();
  }, [annotations, selectedAnnotationIds]);

  const editingTextId = editingText?.id ?? null;
  useEffect(() => {
    if (!editingTextId) return;
    requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.select();
    });
  }, [editingTextId]);

  useEffect(() => {
    if (selectedAnnotationIds.length > 1) lastMultiSelectionRef.current = selectedAnnotationIds;
  }, [selectedAnnotationIds]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [contextMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !draftPolygon &&
        !draftArrow &&
        !draftMeasurement &&
        event.key === 'Enter' &&
        selectedTextEditable &&
        !editingText &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        startTextEditing(selectedTextEditable);
        return;
      }
      if (draftMeasurement) {
        if (event.key === 'Enter' && draftMeasurement.points.length >= 4) {
          event.preventDefault();
          const annotation = createAnnotation({
            kind: 'measurement',
            anchorMode: 'map',
            position: draftMeasurement.position,
            geoAnchor: draftMeasurement.geoAnchor,
            style: defaultStyle,
          });
          if (annotation.kind === 'measurement') {
            addAnnotation({
              ...annotation,
              points: draftMeasurement.points,
              geoPoints: draftMeasurement.geoPoints,
            });
          }
          setDraftMeasurement(null);
          useToolStore.getState().setActiveTool('move');
          return;
        }
        if (event.key === 'Escape') {
          setDraftMeasurement(null);
          return;
        }
      }
      if (draftArrow) {
        if (event.key === 'Escape') {
          setDraftArrow(null);
          return;
        }
      }
      if (!draftPolygon) return;
      if (event.key === 'Enter' && draftPolygon.points.length >= 6) {
        event.preventDefault();
        const annotation = createAnnotation({
          kind: 'polygon',
          anchorMode: defaultAnchorMode,
          position: draftPolygon.position,
          geoAnchor: draftPolygon.geoAnchor,
          style: defaultStyle,
        });
        if (annotation.kind === 'polygon') {
          addAnnotation({ ...annotation, points: draftPolygon.points });
        }
        setDraftPolygon(null);
      }
      if (event.key === 'Escape') setDraftPolygon(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    addAnnotation,
    defaultAnchorMode,
    defaultStyle,
    draftArrow,
    draftMeasurement,
    draftPolygon,
    editingText,
    selectedTextEditable,
    startTextEditing,
  ]);

  const idsForAnnotation = useCallback(
    (annotation: Annotation) => {
      if (!annotation.groupId) return [annotation.id];
      const group = annotationGroups.find((item) => item.id === annotation.groupId);
      return group?.annotationIds ?? [annotation.id];
    },
    [annotationGroups],
  );

  const currentBounds = useCallback(
    (annotation: Annotation) => boundsFromAnnotation(annotation, anchorPosition(annotation, map)),
    [map],
  );

  const stagePointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) * size.width) / rect.width,
        y: ((clientY - rect.top) * size.height) / rect.height,
      };
    },
    [size.height, size.width],
  );

  const smartSnapDelta = useCallback(
    (movingIds: string[], delta: { x: number; y: number }) => {
      if (!smartGuidesEnabled) return { delta, guides: null };
      const moving = annotations.filter((annotation) => movingIds.includes(annotation.id));
      const stationary = annotations.filter(
        (annotation) => annotation.visible && !movingIds.includes(annotation.id),
      );
      const movedBounds = unionBounds(
        moving.map((annotation) => {
          const base = currentBounds(annotation);
          return {
            left: base.left + delta.x,
            right: base.right + delta.x,
            top: base.top + delta.y,
            bottom: base.bottom + delta.y,
            centerX: base.centerX + delta.x,
            centerY: base.centerY + delta.y,
          };
        }),
      );
      if (!movedBounds) return { delta, guides: null };
      const tolerance = 6;
      let snapX = delta.x;
      let snapY = delta.y;
      let guideX: number | undefined;
      let guideY: number | undefined;
      const movingX = [movedBounds.left, movedBounds.centerX, movedBounds.right];
      const movingY = [movedBounds.top, movedBounds.centerY, movedBounds.bottom];
      for (const target of stationary.map((annotation) => currentBounds(annotation))) {
        for (const sourceX of movingX) {
          for (const targetX of [target.left, target.centerX, target.right]) {
            const diff = targetX - sourceX;
            if (Math.abs(diff) <= tolerance) {
              snapX += diff;
              guideX = targetX;
            }
          }
        }
        for (const sourceY of movingY) {
          for (const targetY of [target.top, target.centerY, target.bottom]) {
            const diff = targetY - sourceY;
            if (Math.abs(diff) <= tolerance) {
              snapY += diff;
              guideY = targetY;
            }
          }
        }
      }
      return {
        delta: { x: snapX, y: snapY },
        guides: guideX !== undefined || guideY !== undefined ? { x: guideX, y: guideY } : null,
      };
    },
    [annotations, currentBounds, smartGuidesEnabled],
  );

  const handleStagePointer = (event: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'editing') return;
    if (!isStageTarget(event)) return;
    const stage = event.target.getStage();
    const rawPointer = stage?.getPointerPosition();
    if (!rawPointer) return;
    const pointer = snapToGrid(rawPointer, gridSnapEnabled, gridSpacing);

    if (activeTool === 'move') {
      selectAnnotation(null);
      return;
    }

    if (activeTool === 'ruler') {
      const geo = pointerGeo(map, rawPointer);
      if (!geo) return;
      setDraftMeasurement((draft) => {
        if (!draft) {
          return {
            position: rawPointer,
            geoAnchor: geo,
            points: [0, 0],
            geoPoints: [geo],
            previewPoint: null,
          };
        }
        return {
          ...draft,
          points: [...draft.points, rawPointer.x - draft.position.x, rawPointer.y - draft.position.y],
          geoPoints: [...draft.geoPoints, geo],
          previewPoint: null,
        };
      });
      return;
    }

    const kind = toolToAnnotationKind(activeTool);
    if (!kind) return;

    // Brush uses a drag-to-draw flow handled by the dedicated pointer listeners
    // on the wrapper div — clicks alone don't commit a stroke.
    if (activeTool === 'paint') return;

    // Image tool: open a file picker, then place the loaded bitmap at the click point.
    if (activeTool === 'image') {
      const placePoint = pointer;
      const placeGeo = defaultAnchorMode === 'map' ? pointerGeo(map, pointer) : null;
      pickImageFile().then((picked) => {
        if (!picked) return;
        const annotation = createAnnotation({
          kind: 'image',
          anchorMode: defaultAnchorMode,
          position: placePoint,
          geoAnchor: placeGeo,
          style: defaultStyle,
        });
        if (annotation.kind === 'image') {
          const maxSide = 320;
          const aspect = picked.width / picked.height;
          const width = aspect >= 1 ? maxSide : maxSide * aspect;
          const height = aspect >= 1 ? maxSide / aspect : maxSide;
          addAnnotation({
            ...annotation,
            src: picked.dataUrl,
            width,
            height,
            naturalWidth: picked.width,
            naturalHeight: picked.height,
          });
        }
        useToolStore.getState().setActiveTool('move');
      });
      return;
    }

    if (activeTool === 'arrow') {
      if (!draftArrow) {
        setDraftArrow({
          position: pointer,
          geoAnchor: defaultAnchorMode === 'map' ? pointerGeo(map, pointer) : null,
          previewPoint: null,
        });
        return;
      }
      const points = [0, 0, pointer.x - draftArrow.position.x, pointer.y - draftArrow.position.y];
      if (Math.hypot(points[2], points[3]) >= 4) {
        const annotation = createAnnotation({
          kind: 'arrow',
          anchorMode: defaultAnchorMode,
          position: draftArrow.position,
          geoAnchor: draftArrow.geoAnchor,
          style: defaultStyle,
        });
        if (annotation.kind === 'arrow') addAnnotation({ ...annotation, points });
      }
      setDraftArrow(null);
      useToolStore.getState().setActiveTool('move');
      return;
    }

    if (kind === 'polygon') {
      setDraftPolygon((draft) => {
        if (!draft) {
          return {
            position: pointer,
            geoAnchor: defaultAnchorMode === 'map' ? pointerGeo(map, pointer) : null,
            points: [0, 0],
            previewPoint: null,
          };
        }
        return {
          ...draft,
          points: [...draft.points, pointer.x - draft.position.x, pointer.y - draft.position.y],
          previewPoint: null,
        };
      });
      return;
    }

    if (activeTool === 'comment') {
      const annotation = createAnnotation({
        kind: 'comment',
        anchorMode: 'map',
        position: pointer,
        geoAnchor: pointerGeo(map, pointer),
        style: defaultStyle,
      });
      addAnnotation(annotation);
      setCommentEditor({ id: annotation.id });
      useToolStore.getState().setActiveTool('move');
      return;
    }

    addAnnotation(
      createAnnotation({
        kind,
        anchorMode: defaultAnchorMode,
        position: pointer,
        geoAnchor: defaultAnchorMode === 'map' ? pointerGeo(map, pointer) : null,
        style: defaultStyle,
      }),
    );
    useToolStore.getState().setActiveTool('move');
  };

  const openContextMenu = (event: KonvaEventObject<MouseEvent>, ids?: string[]) => {
    event.evt.preventDefault();
    event.cancelBubble = true;
    const currentSelection = useDocumentStore.getState().selectedAnnotationIds;
    const lastMultiSelection = lastMultiSelectionRef.current;
    const menuIds =
      ids && currentSelection.length > 1 && ids.some((id) => currentSelection.includes(id))
        ? currentSelection
        : ids &&
          currentSelection.length <= 1 &&
          lastMultiSelection.length > 1 &&
          ids.some((id) => lastMultiSelection.includes(id))
        ? lastMultiSelection
        : ids ?? currentSelection;
    if (menuIds.length) setSelectedAnnotations(menuIds);
    const rect = containerRef.current?.getBoundingClientRect();
    setContextMenu({
      x: event.evt.clientX - (rect?.left ?? 0),
      y: event.evt.clientY - (rect?.top ?? 0),
      ids: menuIds,
    });
  };

  const handleStagePointerMove = (event: KonvaEventObject<MouseEvent>) => {
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    if (draftPolygon) {
      setDraftPolygon({ ...draftPolygon, previewPoint: snapToGrid(pointer, gridSnapEnabled, gridSpacing) });
      return;
    }
    if (draftArrow) {
      setDraftArrow({ ...draftArrow, previewPoint: snapToGrid(pointer, gridSnapEnabled, gridSpacing) });
      return;
    }
    if (draftMeasurement) {
      setDraftMeasurement({ ...draftMeasurement, previewPoint: pointer });
      return;
    }
    if (!marquee) return;
    setMarquee({ ...marquee, end: pointer });
  };

  const handleStagePointerUp = (event: KonvaEventObject<MouseEvent>) => {
    if (!marquee) return;
    const left = Math.min(marquee.start.x, marquee.end.x);
    const right = Math.max(marquee.start.x, marquee.end.x);
    const top = Math.min(marquee.start.y, marquee.end.y);
    const bottom = Math.max(marquee.start.y, marquee.end.y);
    const marqueeBounds = { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
    const hits = annotations
      .filter((annotation) => annotation.visible && boundsIntersect(currentBounds(annotation), marqueeBounds))
      .map((annotation) => annotation.id);
    if (event.evt.metaKey || event.evt.ctrlKey || event.evt.shiftKey) {
      const next = new Set(selectedAnnotationIds);
      for (const id of hits) {
        if (event.evt.altKey) next.delete(id);
        else next.add(id);
      }
      setSelectedAnnotations([...next]);
    } else {
      setSelectedAnnotations(hits);
    }
    setMarquee(null);
  };

  const finishMarquee = useCallback(
    (event: Pick<MouseEvent | PointerEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>) => {
      if (!marquee) return;
      const left = Math.min(marquee.start.x, marquee.end.x);
      const right = Math.max(marquee.start.x, marquee.end.x);
      const top = Math.min(marquee.start.y, marquee.end.y);
      const bottom = Math.max(marquee.start.y, marquee.end.y);
      const marqueeBounds = { left, right, top, bottom, centerX: (left + right) / 2, centerY: (top + bottom) / 2 };
      const hits = annotations
        .filter((annotation) => annotation.visible && boundsIntersect(currentBounds(annotation), marqueeBounds))
        .map((annotation) => annotation.id);
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        const next = new Set(selectedAnnotationIds);
        for (const id of hits) {
          if (event.altKey) next.delete(id);
          else next.add(id);
        }
        setSelectedAnnotations([...next]);
      } else {
        setSelectedAnnotations(hits);
      }
      useToolStore.getState().setActiveTool('move');
      setMarquee(null);
    },
    [annotations, currentBounds, marquee, selectedAnnotationIds, setSelectedAnnotations],
  );

  const finishPolygon = () => {
    if (draftMeasurement && draftMeasurement.points.length >= 4) {
      const annotation = createAnnotation({
        kind: 'measurement',
        anchorMode: 'map',
        position: draftMeasurement.position,
        geoAnchor: draftMeasurement.geoAnchor,
        style: defaultStyle,
      });
      if (annotation.kind === 'measurement') {
        addAnnotation({
          ...annotation,
          points: draftMeasurement.points,
          geoPoints: draftMeasurement.geoPoints,
        });
      }
      setDraftMeasurement(null);
      useToolStore.getState().setActiveTool('move');
      return;
    }
    if (!draftPolygon || draftPolygon.points.length < 6) return;
    const annotation = createAnnotation({
      kind: 'polygon',
      anchorMode: defaultAnchorMode,
      position: draftPolygon.position,
      geoAnchor: draftPolygon.geoAnchor,
      style: defaultStyle,
    });
    if (annotation.kind === 'polygon') {
      addAnnotation({ ...annotation, points: draftPolygon.points });
    }
    setDraftPolygon(null);
    useToolStore.getState().setActiveTool('move');
  };

  const draftPointsWithPreview = (
    draft: { position: { x: number; y: number }; points: number[]; previewPoint: { x: number; y: number } | null },
  ) =>
    draft.previewPoint
      ? [...draft.points, draft.previewPoint.x - draft.position.x, draft.previewPoint.y - draft.position.y]
      : draft.points;

  const beginPaintDraft = (point: { x: number; y: number }) => {
    const draft: FreehandDraft = {
      position: point,
      geoAnchor: defaultAnchorMode === 'map' ? pointerGeo(map, point) : null,
      points: [0, 0],
    };
    paintDraftRef.current = draft;
    setPaintDraft(draft);
  };

  const appendPaintPoint = (point: { x: number; y: number }) => {
    const draft = paintDraftRef.current;
    if (!draft) return;
    const last = draft.points.length - 2;
    const nextX = point.x - draft.position.x;
    const nextY = point.y - draft.position.y;
    const dx = nextX - draft.points[last];
    const dy = nextY - draft.points[last + 1];
    // Skip nearly-stationary samples to keep the stored stroke light.
    if (dx * dx + dy * dy < 16) return;
    const next = { ...draft, points: [...draft.points, nextX, nextY] };
    paintDraftRef.current = next;
    setPaintDraft(next);
  };

  const clearPaintDraft = () => {
    paintDraftRef.current = null;
    setPaintDraft(null);
  };

  return (
    <div
      ref={containerRef}
      data-testid="annotation-stage"
      className="absolute inset-0 z-20"
      style={{ pointerEvents: capturesPointer ? 'auto' : 'none' }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        if (activeTool === 'paint') {
          const point = stagePointFromClient(event.clientX, event.clientY);
          paintPointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          beginPaintDraft(point);
          return;
        }
        if (activeTool !== 'marquee') return;
        const point = stagePointFromClient(event.clientX, event.clientY);
        marqueePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setMarquee({ start: point, end: point });
      }}
      onPointerMove={(event) => {
        if (activeTool === 'paint' && paintPointerRef.current === event.pointerId) {
          const point = stagePointFromClient(event.clientX, event.clientY);
          appendPaintPoint(point);
          return;
        }
        if (activeTool !== 'marquee' || marqueePointerRef.current !== event.pointerId) return;
        const point = stagePointFromClient(event.clientX, event.clientY);
        setMarquee((draft) => (draft ? { ...draft, end: point } : draft));
      }}
      onPointerUp={(event) => {
        if (activeTool === 'paint' && paintPointerRef.current === event.pointerId) {
          paintPointerRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
          appendPaintPoint(stagePointFromClient(event.clientX, event.clientY));
          const draft = paintDraftRef.current;
          clearPaintDraft();
          if (draft && draft.points.length >= 4) {
            const annotation = createAnnotation({
              kind: 'line',
              anchorMode: defaultAnchorMode,
              position: draft.position,
              geoAnchor: draft.geoAnchor,
              style: defaultStyle,
            });
            if (annotation.kind === 'line') {
              addAnnotation({ ...annotation, name: 'Brush stroke', lineRole: 'brush', points: draft.points });
            }
          }
          useToolStore.getState().setActiveTool('move');
          return;
        }
        if (activeTool !== 'marquee' || marqueePointerRef.current !== event.pointerId) return;
        marqueePointerRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        finishMarquee(event.nativeEvent);
      }}
      onPointerCancel={() => {
        marqueePointerRef.current = null;
        paintPointerRef.current = null;
        setMarquee(null);
        clearPaintDraft();
      }}
    >
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={handleStagePointer}
        onMouseMove={handleStagePointerMove}
        onMouseUp={handleStagePointerUp}
        onDblClick={finishPolygon}
        onContextMenu={(event) => {
          if (mode !== 'editing') return;
          if (selectedAnnotationIds.length > 0) openContextMenu(event);
          else event.evt.preventDefault();
        }}
      >
        <Layer>
          {gridSnapEnabled &&
            Array.from({ length: Math.ceil(size.width / gridSpacing) + 1 }, (_, index) => (
              <Line
                key={`grid-x-${index}`}
                points={[index * gridSpacing, 0, index * gridSpacing, size.height]}
                stroke="rgba(0,122,255,0.12)"
                strokeWidth={1}
                listening={false}
              />
            ))}
          {gridSnapEnabled &&
            Array.from({ length: Math.ceil(size.height / gridSpacing) + 1 }, (_, index) => (
              <Line
                key={`grid-y-${index}`}
                points={[0, index * gridSpacing, size.width, index * gridSpacing]}
                stroke="rgba(0,122,255,0.12)"
                strokeWidth={1}
                listening={false}
              />
            ))}
          {annotations.map((annotation) => {
            if (!annotation.visible) return null;
            const position = anchorPosition(annotation, map);
            const selected = selectedAnnotationIds.includes(annotation.id);
            return (
              <Group
                key={annotation.id}
                ref={(node) => {
                  if (node) nodeRefs.current.set(annotation.id, node);
                  else nodeRefs.current.delete(annotation.id);
                }}
                id={annotation.id}
                x={position.x}
                y={position.y}
                rotation={annotation.rotation}
                globalCompositeOperation={blendOperation(annotation.style)}
                draggable={mode === 'editing' && !annotation.locked && activeTool === 'move'}
                onMouseDown={(event) => {
                  if (event.evt.button === 2) {
                    event.cancelBubble = true;
                    return;
                  }
                  blurFocusedControl();
                  if (
                    event.evt.detail >= 2 &&
                    (annotation.kind === 'text' || annotation.kind === 'pin')
                  ) {
                    event.cancelBubble = true;
                    startTextEditing(annotation);
                  }
                }}
                onContextMenu={(event) => openContextMenu(event, idsForAnnotation(annotation))}
                onClick={(event) => {
                  event.cancelBubble = true;
                  blurFocusedControl();
                  if (event.evt.metaKey || event.evt.ctrlKey || event.evt.shiftKey) {
                    toggleAnnotationSelection(annotation.id);
                  } else {
                    setSelectedAnnotations(idsForAnnotation(annotation));
                  }
                }}
                onDblClick={(event) => {
                  event.cancelBubble = true;
                  if (annotation.kind === 'text' || annotation.kind === 'pin') startTextEditing(annotation);
                  else if (annotation.kind === 'comment') setCommentEditor({ id: annotation.id });
                }}
                onDblTap={(event) => {
                  event.cancelBubble = true;
                  if (annotation.kind === 'text' || annotation.kind === 'pin') startTextEditing(annotation);
                  else if (annotation.kind === 'comment') setCommentEditor({ id: annotation.id });
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  setSelectedAnnotations(idsForAnnotation(annotation));
                }}
                onDragStart={() => {
                  const ids = selectedAnnotationIds.includes(annotation.id)
                    ? selectedAnnotationIds
                    : idsForAnnotation(annotation);
                  setSelectedAnnotations(ids);
                  dragStartRef.current = Object.fromEntries(
                    ids
                      .map((id) => annotations.find((item) => item.id === id))
                      .filter((item): item is Annotation => Boolean(item))
                      .map((item) => {
                        const pos = anchorPosition(item, map);
                        return [item.id, { x: pos.x, y: pos.y, geoAnchor: item.geoAnchor }];
                      }),
                  );
                }}
                onDragMove={(event) => {
                  const starts = dragStartRef.current;
                  const activeStart = starts[annotation.id];
                  if (!activeStart) return;
                  let delta = { x: event.target.x() - activeStart.x, y: event.target.y() - activeStart.y };
                  if (gridSnapEnabled) {
                    const snapped = snapToGrid(
                      { x: activeStart.x + delta.x, y: activeStart.y + delta.y },
                      true,
                      gridSpacing,
                    );
                    delta = { x: snapped.x - activeStart.x, y: snapped.y - activeStart.y };
                  }
                  const snapped = smartSnapDelta(Object.keys(starts), delta);
                  setGuides(snapped.guides);
                  event.target.position({
                    x: activeStart.x + snapped.delta.x,
                    y: activeStart.y + snapped.delta.y,
                  });
                }}
                onDragEnd={(event) => {
                  const starts = dragStartRef.current;
                  const activeStart = starts[annotation.id];
                  if (!activeStart) return;
                  const delta = { x: event.target.x() - activeStart.x, y: event.target.y() - activeStart.y };
                  const moves = Object.entries(starts).map(([id, start]) => {
                    const nextPosition = { x: start.x + delta.x, y: start.y + delta.y };
                    return {
                      id,
                      ...normalizeDragPosition(
                        annotations.find((item) => item.id === id) ?? annotation,
                        map,
                        nextPosition,
                      ),
                    };
                  });
                  moveAnnotations(moves);
                  dragStartRef.current = {};
                  setGuides(null);
                }}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const patch = applyAnnotationTransform(annotation, {
                    position: { x: node.x(), y: node.y() },
                    rotation: node.rotation(),
                    scaleX: node.scaleX(),
                    scaleY: node.scaleY(),
                  });
                  if (annotation.anchorMode === 'map') {
                    patch.geoAnchor = pointerGeo(map, { x: node.x(), y: node.y() });
                  }
                  node.scale({ x: 1, y: 1 });
                  updateAnnotation(annotation.id, patch);
                }}
              >
                <FillShape annotation={annotation} editing={editingText?.id === annotation.id} />
                {selected && annotation.locked && (
                  <Rect
                    x={-8}
                    y={-8}
                    width={16}
                    height={16}
                    stroke="#ff9500"
                    dash={[4, 4]}
                    listening={false}
                  />
                )}
              </Group>
            );
          })}
          {draftPolygon && (
            <>
              <Line
                x={draftPolygon.position.x}
                y={draftPolygon.position.y}
                points={draftPointsWithPreview(draftPolygon)}
                stroke={defaultStyle.strokeColor}
                strokeWidth={defaultStyle.strokeWidth}
                fill={defaultStyle.fillColor}
                opacity={0.55}
                closed={draftPolygon.points.length >= 6}
                dash={[5, 5]}
                listening={false}
              />
              <Circle
                x={draftPolygon.position.x}
                y={draftPolygon.position.y}
                radius={Math.max(4, defaultStyle.strokeWidth + 2)}
                fill={defaultStyle.strokeColor}
                opacity={0.75}
                listening={false}
              />
            </>
          )}
          {draftArrow && (
            <>
              <Arrow
                x={draftArrow.position.x}
                y={draftArrow.position.y}
                points={
                  draftArrow.previewPoint
                    ? [0, 0, draftArrow.previewPoint.x - draftArrow.position.x, draftArrow.previewPoint.y - draftArrow.position.y]
                    : [0, 0, 0, 0]
                }
                stroke={defaultStyle.strokeColor}
                fill={defaultStyle.strokeColor}
                strokeWidth={defaultStyle.strokeWidth}
                pointerLength={12}
                pointerWidth={12}
                opacity={0.75}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
              <Circle
                x={draftArrow.position.x}
                y={draftArrow.position.y}
                radius={Math.max(4, defaultStyle.strokeWidth + 2)}
                fill={defaultStyle.strokeColor}
                opacity={0.75}
                listening={false}
              />
            </>
          )}
          {draftMeasurement && (
            <>
              <Line
                x={draftMeasurement.position.x}
                y={draftMeasurement.position.y}
                points={draftPointsWithPreview(draftMeasurement)}
                stroke={defaultStyle.strokeColor}
                strokeWidth={defaultStyle.strokeWidth}
                dash={[6, 5]}
                listening={false}
              />
              <Circle
                x={draftMeasurement.position.x}
                y={draftMeasurement.position.y}
                radius={Math.max(4, defaultStyle.strokeWidth + 2)}
                fill={defaultStyle.strokeColor}
                opacity={0.75}
                listening={false}
              />
            </>
          )}
          {paintDraft && (
            <Line
              x={paintDraft.position.x}
              y={paintDraft.position.y}
              points={paintDraft.points}
              stroke={defaultStyle.strokeColor}
              strokeWidth={defaultStyle.strokeWidth}
              opacity={0.8}
              lineCap="round"
              lineJoin="round"
              tension={paintDraft.points.length > 4 ? 0.35 : 0}
              listening={false}
            />
          )}
          {marquee && (
            <Rect
              x={Math.min(marquee.start.x, marquee.end.x)}
              y={Math.min(marquee.start.y, marquee.end.y)}
              width={Math.abs(marquee.end.x - marquee.start.x)}
              height={Math.abs(marquee.end.y - marquee.start.y)}
              fill="rgba(0,122,255,0.12)"
              stroke="#007aff"
              dash={[4, 4]}
              listening={false}
            />
          )}
          {guides?.x !== undefined && (
            <Line
              points={[guides.x, 0, guides.x, size.height]}
              stroke="#ff2d55"
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
            />
          )}
          {guides?.y !== undefined && (
            <Line
              points={[0, guides.y, size.width, guides.y]}
              stroke="#ff2d55"
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            enabledAnchors={
              isLineLike(selectedAnnotation)
                ? ['middle-left', 'middle-right']
                : [
                    'top-left',
                    'top-center',
                    'top-right',
                    'middle-left',
                    'middle-right',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right',
                  ]
            }
            borderStroke="#007aff"
            anchorStroke="#007aff"
            anchorFill="#ffffff"
            ignoreStroke
            boundBoxFunc={(_oldBox, newBox) => {
              const minDimension = isLineLike(selectedAnnotation)
                ? Math.max(Math.abs(newBox.width), Math.abs(newBox.height))
                : Math.min(Math.abs(newBox.width), Math.abs(newBox.height));
              if (minDimension < 4) return _oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
      {editingAnnotation && editorMetrics && (
        <textarea
          ref={textEditorRef}
          aria-label="Edit canvas text"
          value={editingText?.value ?? ''}
          onChange={(event) => setEditingText({ id: editingAnnotation.id, value: event.target.value })}
          onBlur={commitTextEditing}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditingText(null);
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              commitTextEditing();
            }
          }}
          className="absolute z-30 resize-none rounded-[6px] border border-[var(--accent)] bg-[var(--glass)] px-2 py-1 text-[var(--text)] outline-none shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
          style={{
            left: editorMetrics.x,
            top: editorMetrics.y,
            width: editorMetrics.width,
            minHeight: editingAnnotation.style.textSize + 18,
            fontFamily: editingAnnotation.style.fontFamily,
            fontSize: editingAnnotation.style.textSize,
            color: editingAnnotation.style.textColor,
            lineHeight: 1.2,
            transform: `rotate(${editingAnnotation.rotation}deg)`,
            transformOrigin: 'top left',
          }}
        />
      )}
      {commentEditor && <CommentPopover editorId={commentEditor.id} onClose={() => setCommentEditor(null)} />}
      {contextMenu && (
        <div
          role="menu"
          aria-label="Canvas selection menu"
          className="absolute z-40 min-w-36 rounded-[10px] border border-[var(--divider)] bg-[var(--glass-strong)] p-1 text-[12px] text-[var(--text)] shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={contextMenu.ids.length < 2}
            onClick={() => {
              useDocumentStore.getState().setSelectedAnnotations(contextMenu.ids);
              useDocumentStore.getState().groupSelectedAnnotations();
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-[7px] px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:text-[var(--text-3)] enabled:hover:bg-[var(--hover)]"
          >
            Group selection
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!annotations.some((annotation) => contextMenu.ids.includes(annotation.id) && annotation.groupId)}
            onClick={() => {
              useDocumentStore.getState().setSelectedAnnotations(contextMenu.ids);
              useDocumentStore.getState().ungroupSelectedAnnotations();
              setContextMenu(null);
            }}
            className="flex w-full items-center rounded-[7px] px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:text-[var(--text-3)] enabled:hover:bg-[var(--hover)]"
          >
            Ungroup selection
          </button>
        </div>
      )}
    </div>
  );
}
