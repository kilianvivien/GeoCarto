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
  PenLine,
  Download,
  DownloadCloud,
  Upload,
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
  Heading,
  Copyright,
  Compass,
  Scaling,
  type LucideIcon,
} from 'lucide-react';
import type { AnnotationKind, GeometryKind } from '@/project/cartoproj';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { hintDiscreteHistoryLabel } from '@/state/historyStore';
import { featureCollectionToLayer } from '@/import/geojson';
import { pickAndImportGeoJson } from '@/import/importLayers';
import { exportAllLayersGeoJson, exportLayerGeoJson } from '@/export/geojson';
import { useNotices } from '@/ui/notices';
import { translate, useLocale } from '@/i18n/useLocale';

/** Create an empty vector layer and drop straight into edit mode to draw it. */
function createBlankLayer() {
  const layer = featureCollectionToLayer(translate('layer.new'), { type: 'FeatureCollection', features: [] });
  useDocumentStore.getState().addLayer(layer);
  useEditStore.getState().enterEdit(layer.id);
  useEditStore.getState().setTool('polygon');
}

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
  titleblock: Heading,
  sourcecredit: Copyright,
  scalebar: Scaling,
  northarrow: Compass,
};

function LayerRow({ layerId }: { layerId: string }) {
  const t = useLocale((s) => s.t);
  const layer = useDocumentStore((s) => s.project.layers.find((l) => l.id === layerId));
  const selected = useDocumentStore((s) => s.selectedLayerId === layerId);
  const layerCount = useDocumentStore((s) => s.project.layers.length);
  const index = useDocumentStore((s) => s.project.layers.findIndex((l) => l.id === layerId));
  const { selectLayer, renameLayer, setLayerVisible, setLayerLocked, moveLayer, removeLayer } =
    useDocumentStore.getState();
  const isEditingVectors = useEditStore((s) => s.editingLayerId === layerId);

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
      <div
        className={`flex items-center transition-opacity group-hover:opacity-100 group-aria-[selected=true]:opacity-100 ${
          isEditingVectors ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <RowButton
          label={isEditingVectors ? t('layer.finishEditing') : t('layer.editFeatures')}
          disabled={!canMutate}
          active={isEditingVectors}
          onClick={() => {
            const edit = useEditStore.getState();
            if (isEditingVectors) edit.exitEdit();
            else edit.enterEdit(layer.id);
          }}
        >
          <PenLine size={13} />
        </RowButton>
        <RowButton
          label={t('layer.export')}
          disabled={layer.featureCount === 0}
          onClick={() => {
            const push = useNotices.getState().push;
            void exportLayerGeoJson(layer)
              .then((saved) => {
                if (saved) push(t('layer.exported', { name: layer.name }));
              })
              .catch(() => push(t('layer.exportFailed'), 'error'));
          }}
        >
          <Download size={13} />
        </RowButton>
        <RowButton
          label={layer.visible ? t('layer.hide') : t('layer.show')}
          onClick={() => setLayerVisible(layer.id, !layer.visible)}
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </RowButton>
        <RowButton
          label={layer.locked ? t('layer.unlock') : t('layer.lock')}
          onClick={() => setLayerLocked(layer.id, !layer.locked)}
        >
          {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </RowButton>
        <RowButton
          label={t('layer.moveUp')}
          disabled={!canMutate || index === layerCount - 1}
          onClick={() => moveLayer(layer.id, 'up')}
        >
          <ChevronUp size={13} />
        </RowButton>
        <RowButton label={t('layer.moveDown')} disabled={!canMutate || index === 0} onClick={() => moveLayer(layer.id, 'down')}>
          <ChevronDown size={13} />
        </RowButton>
        <RowButton
          label={t('layer.delete')}
          disabled={!canMutate}
          onClick={() => {
            if (!window.confirm(t('layer.deleteConfirm', { name: layer.name }))) return;
            hintDiscreteHistoryLabel('Delete layer');
            if (useEditStore.getState().editingLayerId === layer.id) useEditStore.getState().exitEdit();
            removeLayer(layer.id);
          }}
        >
          <Trash2 size={13} />
        </RowButton>
      </div>
    </div>
  );
}

function AnnotationRow({ annotationId }: { annotationId: string }) {
  const t = useLocale((s) => s.t);
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
          label={annotation.visible ? t('annotation.hide') : t('annotation.show')}
          onClick={() => setAnnotationVisible(annotation.id, !annotation.visible)}
        >
          {annotation.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </RowButton>
        <RowButton
          label={annotation.locked ? t('annotation.unlock') : t('annotation.lock')}
          onClick={() => setAnnotationLocked(annotation.id, !annotation.locked)}
        >
          {annotation.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </RowButton>
        <RowButton
          label={t('layer.moveUp')}
          disabled={index === annotationCount - 1}
          onClick={() => moveAnnotation(annotation.id, 'up')}
        >
          <ChevronUp size={13} />
        </RowButton>
        <RowButton
          label={t('layer.moveDown')}
          disabled={index === 0}
          onClick={() => moveAnnotation(annotation.id, 'down')}
        >
          <ChevronDown size={13} />
        </RowButton>
        <RowButton
          label={t('annotation.delete')}
          disabled={annotation.locked}
          onClick={() => {
            hintDiscreteHistoryLabel('Delete annotation');
            removeAnnotation(annotation.id);
          }}
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
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 items-center justify-center rounded-[4px] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-30 disabled:hover:bg-transparent ${
        active ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'
      }`}
    >
      {children}
    </button>
  );
}

/** Layer panel — the Figma-style tree of imported layers (design.md §4.4.2). */
export function LayerPanel() {
  const t = useLocale((s) => s.t);
  const layers = useDocumentStore((s) => s.project.layers);
  const annotations = useDocumentStore((s) => s.project.annotations);
  const mode = useDocumentStore((s) => s.project.mode);
  const projectName = useDocumentStore((s) => s.project.meta.name);
  const locked = mode !== 'editing';
  const hasFeatures = layers.some((layer) => layer.featureCount > 0);

  const exportAll = () => {
    const push = useNotices.getState().push;
    void exportAllLayersGeoJson(layers, projectName)
      .then((result) => {
        if (!result) {
          push(t('layer.exportAllEmpty'), 'error');
        } else if (result.saved) {
          push(t('layer.exportedAll', { layers: result.layers, features: result.features }));
        }
      })
      .catch(() => push(t('layer.exportFailed'), 'error'));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span
          className="cursor-help text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]"
          title={t('layer.dataHint')}
        >
          {t('layer.dataLayers')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('layer.new')}
            title={t('layer.newTitle')}
            disabled={locked}
            onClick={createBlankLayer}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--glass-thin)] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            aria-label={t('layer.import')}
            title={t('layer.importTitle')}
            disabled={locked}
            onClick={pickAndImportGeoJson}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--glass-thin)] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={13} />
          </button>
          <button
            type="button"
            aria-label={t('layer.exportAll')}
            title={t('layer.exportAllTitle')}
            disabled={locked || !hasFeatures}
            onClick={exportAll}
            className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--glass-thin)] text-[var(--text-2)] transition-colors hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DownloadCloud size={13} />
          </button>
        </div>
      </div>

      {annotations.length > 0 && (
        <div className="flex flex-col gap-1">
          <span
            className="cursor-help px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-3)]"
            title={t('layer.annotationsHint')}
          >
            {t('layer.annotations')}
          </span>
          <div role="tree" className="flex flex-col gap-px rounded-[8px] bg-[var(--glass-thin)] p-1">
            {[...annotations].reverse().map((annotation) => (
              <AnnotationRow key={annotation.id} annotationId={annotation.id} />
            ))}
          </div>
        </div>
      )}

      {layers.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-[var(--divider)] bg-[var(--glass-thin)] p-3 text-center">
          {locked ? (
            <div className="py-2 text-[11.5px] text-[var(--text-3)]">
              {t('layer.lockToStart')}
            </div>
          ) : (
            <>
              <div className="text-[11.5px] text-[var(--text-3)]">{t('layer.none')}</div>
              <p className="text-[11px] leading-snug text-[var(--text-3)]">{t('layer.dataHint')}</p>
              <button
                type="button"
                onClick={createBlankLayer}
                className="flex items-center justify-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-[var(--text-on-accent)] transition-opacity hover:opacity-90"
              >
                <Plus size={14} />
                {t('layer.new')}
              </button>
              <button
                type="button"
                title={t('layer.importTitle')}
                onClick={pickAndImportGeoJson}
                className="text-[11px] text-[var(--text-3)] underline-offset-2 transition-colors hover:text-[var(--text-2)] hover:underline"
              >
                {t('layer.importFile')}
              </button>
            </>
          )}
        </div>
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
