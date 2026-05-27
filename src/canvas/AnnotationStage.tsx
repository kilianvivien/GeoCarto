import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Arrow, Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type maplibregl from 'maplibre-gl';
import type { Annotation, PinAnnotation, PinIcon, TextAnnotation } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useToolStore, toolToAnnotationKind } from '@/state/toolStore';
import { useViewportStore } from '@/state/viewportStore';
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
        <Rect
          {...common}
          width={annotation.width}
          height={annotation.height}
          cornerRadius={annotation.cornerRadius}
        />
      );
    case 'ellipse':
      return <Ellipse {...common} radiusX={annotation.radiusX} radiusY={annotation.radiusY} />;
    case 'line':
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
            pointerLength={12}
            pointerWidth={12}
            lineCap="round"
            lineJoin="round"
          />
        </>
      );
    case 'polygon':
      return <Line {...common} points={annotation.points} closed={annotation.closed} lineJoin="round" />;
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
  }
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
  return event.target === event.target.getStage();
}

function isLineLike(annotation: Annotation | undefined) {
  return annotation?.kind === 'line' || annotation?.kind === 'arrow';
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
  const selectedAnnotationId = useDocumentStore((s) => s.selectedAnnotationId);
  const mode = useDocumentStore((s) => s.project.mode);
  const { addAnnotation, selectAnnotation, updateAnnotation } = useDocumentStore.getState();
  const activeTool = useToolStore((s) => s.activeTool);
  const defaultAnchorMode = useToolStore((s) => s.defaultAnchorMode);
  const defaultStyle = useToolStore((s) => s.defaultStyle);
  const size = useStageSize(containerRef);
  const [draftPolygon, setDraftPolygon] = useState<{
    position: { x: number; y: number };
    geoAnchor: [number, number] | null;
    points: number[];
  } | null>(null);
  const [editingText, setEditingText] = useState<{ id: string; value: string } | null>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);

  const capturesPointer = mode === 'editing' && (activeTool === 'move' || toolToAnnotationKind(activeTool) !== null);
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
    const selectedNode =
      selectedAnnotation && selectedAnnotation.visible && !selectedAnnotation.locked
        ? nodeRefs.current.get(selectedAnnotation.id)
        : null;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedAnnotation]);

  const editingTextId = editingText?.id ?? null;
  useEffect(() => {
    if (!editingTextId) return;
    requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.select();
    });
  }, [editingTextId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !draftPolygon &&
        event.key === 'Enter' &&
        selectedTextEditable &&
        !editingText &&
        !isTypingTarget(event.target)
      ) {
        event.preventDefault();
        startTextEditing(selectedTextEditable);
        return;
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
    draftPolygon,
    editingText,
    selectedTextEditable,
    startTextEditing,
  ]);

  const handleStagePointer = (event: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'editing') return;
    if (!isStageTarget(event)) return;
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (activeTool === 'move') {
      selectAnnotation(null);
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

  const finishPolygon = () => {
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
    >
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={handleStagePointer}
        onDblClick={finishPolygon}
      >
        <Layer>
          {annotations.map((annotation) => {
            if (!annotation.visible) return null;
            const position = anchorPosition(annotation, map);
            const selected = selectedAnnotationId === annotation.id;
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
                  blurFocusedControl();
                  if (
                    event.evt.detail >= 2 &&
                    (annotation.kind === 'text' || annotation.kind === 'pin')
                  ) {
                    event.cancelBubble = true;
                    startTextEditing(annotation);
                  }
                }}
                onClick={(event) => {
                  event.cancelBubble = true;
                  blurFocusedControl();
                  selectAnnotation(annotation.id);
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
                  selectAnnotation(annotation.id);
                }}
                onDragEnd={(event) => {
                  const next = normalizeDragPosition(annotation, map, {
                    x: event.target.x(),
                    y: event.target.y(),
                  });
                  updateAnnotation(annotation.id, next as Partial<Annotation>);
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
    </div>
  );
}
