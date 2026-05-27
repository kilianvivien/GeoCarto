import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type maplibregl from 'maplibre-gl';
import type { Annotation, PinAnnotation, PinIcon, TextAnnotation } from '@/project/cartoproj';
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

function FillShape({
  annotation,
  editing,
}: {
  annotation: Annotation;
  editing?: boolean;
}) {
  const common = {
    opacity: annotation.opacity,
    fill: annotation.style.fillColor,
    stroke: annotation.style.strokeColor,
    strokeWidth: annotation.style.strokeWidth,
    dash: strokeDash(annotation.style),
  };

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
          <Rect {...common} width={annotation.width} height={annotation.height} cornerRadius={annotation.cornerRadius} />
          <HatchOverlay kind="rectangle" width={annotation.width} height={annotation.height} annotation={annotation} />
        </>
      );
    case 'ellipse':
      return (
        <>
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
      return (
        <>
          <LineSelectionBounds points={annotation.points} strokeWidth={annotation.style.strokeWidth} />
          <Line
            points={annotation.points}
            opacity={annotation.opacity}
            stroke={annotation.style.strokeColor}
            strokeWidth={annotation.style.strokeWidth}
            dash={strokeDash(annotation.style)}
            lineCap="round"
            lineJoin="round"
          />
        </>
      );
    case 'arrow':
      return (
        <>
          <LineSelectionBounds points={annotation.points} strokeWidth={annotation.style.strokeWidth} />
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
          />
        </>
      );
    case 'polygon':
      return (
        <>
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
  }
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
  } | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const [marquee, setMarquee] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [draftMeasurement, setDraftMeasurement] = useState<{
    position: { x: number; y: number };
    geoAnchor: [number, number] | null;
    points: number[];
    geoPoints: [number, number][];
  } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ids: string[] } | null>(null);
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
          };
        }
        return {
          ...draft,
          points: [...draft.points, rawPointer.x - draft.position.x, rawPointer.y - draft.position.y],
          geoPoints: [...draft.geoPoints, geo],
        };
      });
      return;
    }

    const kind = toolToAnnotationKind(activeTool);
    if (!kind) return;

    if (kind === 'polygon') {
      setDraftPolygon((draft) => {
        if (!draft) {
          return {
            position: pointer,
            geoAnchor: defaultAnchorMode === 'map' ? pointerGeo(map, pointer) : null,
            points: [0, 0],
          };
        }
        return {
          ...draft,
          points: [...draft.points, pointer.x - draft.position.x, pointer.y - draft.position.y],
        };
      });
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
    if (!marquee) return;
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
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

  return (
    <div
      ref={containerRef}
      data-testid="annotation-stage"
      className="absolute inset-0 z-20"
      style={{ pointerEvents: capturesPointer ? 'auto' : 'none' }}
      onPointerDown={(event) => {
        if (activeTool !== 'marquee' || event.button !== 0) return;
        const point = stagePointFromClient(event.clientX, event.clientY);
        marqueePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setMarquee({ start: point, end: point });
      }}
      onPointerMove={(event) => {
        if (activeTool !== 'marquee' || marqueePointerRef.current !== event.pointerId) return;
        const point = stagePointFromClient(event.clientX, event.clientY);
        setMarquee((draft) => (draft ? { ...draft, end: point } : draft));
      }}
      onPointerUp={(event) => {
        if (activeTool !== 'marquee' || marqueePointerRef.current !== event.pointerId) return;
        marqueePointerRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        finishMarquee(event.nativeEvent);
      }}
      onPointerCancel={() => {
        marqueePointerRef.current = null;
        setMarquee(null);
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
                }}
                onDblTap={(event) => {
                  event.cancelBubble = true;
                  if (annotation.kind === 'text' || annotation.kind === 'pin') startTextEditing(annotation);
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
            <Line
              x={draftPolygon.position.x}
              y={draftPolygon.position.y}
              points={draftPolygon.points}
              stroke={defaultStyle.strokeColor}
              strokeWidth={defaultStyle.strokeWidth}
              fill={defaultStyle.fillColor}
              opacity={0.55}
              closed={draftPolygon.points.length >= 6}
              dash={[5, 5]}
            />
          )}
          {draftMeasurement && (
            <Line
              x={draftMeasurement.position.x}
              y={draftMeasurement.position.y}
              points={draftMeasurement.points}
              stroke={defaultStyle.strokeColor}
              strokeWidth={defaultStyle.strokeWidth}
              dash={[6, 5]}
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
