import { useState } from 'react';
import {
  Plus,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  ChevronUp,
  ChevronDown,
  Trash2,
  MapPin,
  Spline,
  Hexagon,
  Shapes,
  Type,
  Square,
  Circle,
  ArrowUpRight,
  Image as ImageIcon,
  List,
  MessageSquare,
  Ruler,
  type LucideIcon,
} from 'lucide-react';
import type { AnnotationKind, GeometryKind } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { pickAndImportGeoJson } from '@/import/importLayers';

const GEOMETRY_ICON: Record<GeometryKind, LucideIcon> = {
  point: MapPin,
  line: Spline,
  polygon: Hexagon,
  mixed: Shapes,
};

const ANNOTATION_ICON: Record<AnnotationKind, LucideIcon> = {
  text: Type,
  rectangle: Square,
  ellipse: Circle,
  line: Spline,
  arrow: ArrowUpRight,
  polygon: Hexagon,
  pin: MapPin,
  measurement: Ruler,
  image: ImageIcon,
  legend: List,
  comment: MessageSquare,
};

function LayerRow({ layerId }: { layerId: string }) {
  const layer = useDocumentStore((s) => s.project.layers.find((l) => l.id === layerId));
  const selected = useDocumentStore((s) => s.selectedLayerId === layerId);
  const layerCount = useDocumentStore((s) => s.project.layers.length);
  const index = useDocumentStore((s) => s.project.layers.findIndex((l) => l.id === layerId));
  const { selectLayer, renameLayer, setLayerVisible, setLayerLocked, moveLayer, removeLayer } =
    useDocumentStore.getState();

  const [editing, setEditing] = useState(false);

  if (!layer) return null;
  const Icon = GEOMETRY_ICON[layer.geometry];
  const canMutate = !layer.locked;

  return (
    <div
      role="treeitem"
      data-testid="layer-row"
      aria-selected={selected}
      onClick={() => selectLayer(layer.id)}
      className={`group flex h-7 items-center gap-1.5 rounded-[6px] px-1.5 ${
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--hover)]'
      }`}
    >
      <Icon
        size={14}
        className={selected ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={layer.name}
          onBlur={(e) => {
            renameLayer(layer.id, e.target.value.trim() || layer.name);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded-[4px] bg-[var(--glass-thin)] px-1 text-[12px] text-[var(--text)] outline outline-1 outline-[var(--accent-ring)]"
        />
      ) : (
        <span
          onDoubleClick={() => {
            if (canMutate) setEditing(true);
          }}
          className="min-w-0 flex-1 truncate text-[12px] text-[var(--text)]"
        >
          {layer.name}
        </span>
      )}
      <span className="mono text-[10px] text-[var(--text-3)]">{layer.featureCount}</span>
      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-aria-[selected=true]:opacity-100">
        <RowButton
          label={layer.visible ? 'Hide layer' : 'Show layer'}
          onClick={() => setLayerVisible(layer.id, !layer.visible)}
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </RowButton>
        <RowButton
          label={layer.locked ? 'Unlock layer' : 'Lock layer'}
          onClick={() => setLayerLocked(layer.id, !layer.locked)}
        >
          {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </RowButton>
        <RowButton
          label="Move up"
          disabled={!canMutate || index === layerCount - 1}
          onClick={() => moveLayer(layer.id, 'up')}
        >
          <ChevronUp size={13} />
        </RowButton>
        <RowButton label="Move down" disabled={!canMutate || index === 0} onClick={() => moveLayer(layer.id, 'down')}>
          <ChevronDown size={13} />
        </RowButton>
        <RowButton label="Delete layer" disabled={!canMutate} onClick={() => removeLayer(layer.id)}>
          <Trash2 size={13} />
        </RowButton>
      </div>
    </div>
  );
}

function AnnotationRow({ annotationId }: { annotationId: string }) {
  const annotation = useDocumentStore((s) =>
    s.project.annotations.find((item) => item.id === annotationId),
  );
  const selected = useDocumentStore((s) => s.selectedAnnotationId === annotationId);
  const annotationCount = useDocumentStore((s) => s.project.annotations.length);
  const index = useDocumentStore((s) =>
    s.project.annotations.findIndex((item) => item.id === annotationId),
  );
  const {
    selectAnnotation,
    renameAnnotation,
    setAnnotationVisible,
    setAnnotationLocked,
    moveAnnotation,
    removeAnnotation,
  } = useDocumentStore.getState();
  const [editing, setEditing] = useState(false);

  if (!annotation) return null;
  const Icon = ANNOTATION_ICON[annotation.kind];

  return (
    <div
      role="treeitem"
      data-testid="annotation-row"
      aria-selected={selected}
      onClick={() => selectAnnotation(annotation.id)}
      className={`group flex h-7 items-center gap-1.5 rounded-[6px] px-1.5 ${
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--hover)]'
      }`}
    >
      <Icon
        size={14}
        className={selected ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={annotation.name}
          onBlur={(e) => {
            renameAnnotation(annotation.id, e.target.value.trim() || annotation.name);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded-[4px] bg-[var(--glass-thin)] px-1 text-[12px] text-[var(--text)] outline outline-1 outline-[var(--accent-ring)]"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className="min-w-0 flex-1 truncate text-[12px] text-[var(--text)]"
        >
          {annotation.name}
        </span>
      )}
      <span className="mono text-[10px] capitalize text-[var(--text-3)]">{annotation.kind}</span>
      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-aria-[selected=true]:opacity-100">
        <RowButton
          label={annotation.visible ? 'Hide annotation' : 'Show annotation'}
          onClick={() => setAnnotationVisible(annotation.id, !annotation.visible)}
        >
          {annotation.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </RowButton>
        <RowButton
          label={annotation.locked ? 'Unlock annotation' : 'Lock annotation'}
          onClick={() => setAnnotationLocked(annotation.id, !annotation.locked)}
        >
          {annotation.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </RowButton>
        <RowButton
          label="Move up"
          disabled={index === annotationCount - 1}
          onClick={() => moveAnnotation(annotation.id, 'up')}
        >
          <ChevronUp size={13} />
        </RowButton>
        <RowButton
          label="Move down"
          disabled={index === 0}
          onClick={() => moveAnnotation(annotation.id, 'down')}
        >
          <ChevronDown size={13} />
        </RowButton>
        <RowButton
          label="Delete annotation"
          disabled={annotation.locked}
          onClick={() => removeAnnotation(annotation.id)}
        >
          <Trash2 size={13} />
        </RowButton>
      </div>
    </div>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-5 w-5 items-center justify-center rounded-[4px] text-[var(--text-3)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** Layer panel — the Figma-style tree of imported layers (design.md §4.4.2). */
export function LayerPanel() {
  const layers = useDocumentStore((s) => s.project.layers);
  const annotations = useDocumentStore((s) => s.project.annotations);
  const mode = useDocumentStore((s) => s.project.mode);
  const locked = mode !== 'editing';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
          Layers
        </span>
        <button
          type="button"
          aria-label="Import data"
          title="Import GeoJSON, TopoJSON, KML, GPX, or Shapefile"
          disabled={locked}
          onClick={pickAndImportGeoJson}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--glass-thin)] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>

      {annotations.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]">
            Annotations
          </span>
          <div role="tree" className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
            {[...annotations].reverse().map((annotation) => (
              <AnnotationRow key={annotation.id} annotationId={annotation.id} />
            ))}
          </div>
        </div>
      )}

      {layers.length === 0 ? (
        <button
          type="button"
          disabled={locked}
          onClick={pickAndImportGeoJson}
          className="rounded-[10px] border border-dashed border-[var(--divider)] bg-[var(--glass-thin)] px-3 py-6 text-center text-[11.5px] text-[var(--text-3)] transition-colors hover:text-[var(--text-2)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          No GeoJSON layers yet.
          <br />
          {locked ? 'Lock the map area before importing.' : 'Drop GeoJSON, TopoJSON, KML, GPX, or a zipped Shapefile, or click to import.'}
        </button>
      ) : (
        <div role="tree" className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
          {[...layers].reverse().map((layer) => (
            <LayerRow key={layer.id} layerId={layer.id} />
          ))}
        </div>
      )}
    </div>
  );
}
