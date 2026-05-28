import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createEmptyProject,
  type Annotation,
  type AnnotationStyle,
  type BasemapConfig,
  type BasemapSublayerKey,
  type CartoProject,
  type ExportFrame,
  type GeoJsonLayer,
  type GeoJsonStyle,
  type PageBackground,
  type PagePresetKey,
} from '@/project/cartoproj';
import type { Viewport } from './viewportStore';

/** A feature picked on the map, surfaced in the attribute inspector. */
export interface SelectedFeature {
  layerId: string;
  properties: Record<string, unknown>;
}

export interface DocumentFileBinding {
  /** File System Access handle (Chromium); null on the download-fallback path. */
  handle: FileSystemFileHandle | null;
  name: string;
}

interface DocumentState {
  project: CartoProject;
  /** Layer selected in the layer panel. */
  selectedLayerId: string | null;
  selectedAnnotationId: string | null;
  selectedAnnotationIds: string[];
  /** Feature clicked on the map. */
  selectedFeature: SelectedFeature | null;
  /** True when the in-memory project has unsaved changes. */
  dirty: boolean;
  /** The on-disk file the project is bound to, if any. */
  file: DocumentFileBinding | null;

  replaceProject: (project: CartoProject, file?: DocumentFileBinding | null) => void;
  markSaved: (file: DocumentFileBinding) => void;

  renameProject: (name: string) => void;
  setBasemap: (basemap: BasemapConfig) => void;
  setBasemapSublayer: (key: BasemapSublayerKey, visible: boolean) => void;
  setExportFrame: (frame: ExportFrame | { width: number; height: number }) => void;
  setExportFramePreset: (preset: PagePresetKey, dims?: { width: number; height: number }) => void;
  setExportFrameSize: (dims: { width: number; height: number }) => void;
  setExportFrameMargin: (margin: number) => void;
  setExportFrameBackground: (background: PageBackground) => void;
  setExportFrameDpiScale: (scale: number) => void;
  lockMapArea: (viewport: Viewport, surfaceSize?: { width: number; height: number }) => void;
  unlockMapArea: () => void;
  addLayer: (layer: GeoJsonLayer) => void;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  updateLayerStyle: (id: string, patch: Partial<GeoJsonStyle>) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  /** Reorder within the stack. `up` moves toward the front (drawn on top). */
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  selectLayer: (id: string | null) => void;
  selectFeature: (feature: SelectedFeature | null) => void;
  addAnnotation: (annotation: Annotation) => void;
  removeAnnotation: (id: string) => void;
  renameAnnotation: (id: string, name: string) => void;
  selectAnnotation: (id: string | null) => void;
  setSelectedAnnotations: (ids: string[]) => void;
  toggleAnnotationSelection: (id: string) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  moveAnnotations: (moves: { id: string; position: { x: number; y: number }; geoAnchor?: [number, number] | null }[]) => void;
  updateAnnotationStyle: (id: string, patch: Partial<AnnotationStyle>) => void;
  moveAnnotation: (id: string, direction: 'up' | 'down') => void;
  setAnnotationVisible: (id: string, visible: boolean) => void;
  setAnnotationLocked: (id: string, locked: boolean) => void;
  groupSelectedAnnotations: () => void;
  ungroupSelectedAnnotations: () => void;
}

/**
 * The project document store — authoritative state for all renderers (PRD §3).
 * MapLibre layer sync, the layer panel, and export all project from this.
 */
export const useDocumentStore = create<DocumentState>()(
  immer((set) => ({
    project: createEmptyProject(),
    selectedLayerId: null,
    selectedAnnotationId: null,
    selectedAnnotationIds: [],
    selectedFeature: null,
    dirty: false,
    file: null,

    replaceProject: (project, file) =>
      set((state) => {
        state.project = project;
        state.selectedLayerId = null;
        state.selectedAnnotationId = null;
        state.selectedAnnotationIds = [];
        state.selectedFeature = null;
        state.dirty = false;
        if (file !== undefined) state.file = file;
      }),

    markSaved: (file) =>
      set((state) => {
        state.file = file;
        state.dirty = false;
      }),

    renameProject: (name) =>
      set((state) => {
        const trimmed = name.trim() || 'Untitled';
        if (state.project.meta.name === trimmed) return;
        state.project.meta.name = trimmed;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setBasemap: (basemap) =>
      set((state) => {
        state.project.basemap = basemap;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setBasemapSublayer: (key, visible) =>
      set((state) => {
        const basemap = state.project.basemap;
        if (basemap.kind !== 'builtin' && basemap.kind !== 'pmtiles-url') return;
        if (basemap.sublayers[key] === visible) return;
        basemap.sublayers[key] = visible;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFrame: (frame) =>
      set((state) => {
        // Preserve existing page-settings extras when callers only pass dimensions.
        state.project.exportFrame = { ...state.project.exportFrame, ...frame };
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFramePreset: (preset, dims) =>
      set((state) => {
        state.project.exportFrame.preset = preset;
        if (dims) {
          state.project.exportFrame.width = dims.width;
          state.project.exportFrame.height = dims.height;
        }
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFrameSize: (dims) =>
      set((state) => {
        if (dims.width <= 0 || dims.height <= 0) return;
        state.project.exportFrame.width = dims.width;
        state.project.exportFrame.height = dims.height;
        state.project.exportFrame.preset = 'custom';
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFrameMargin: (margin) =>
      set((state) => {
        state.project.exportFrame.margin = Math.max(0, margin);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFrameBackground: (background) =>
      set((state) => {
        state.project.exportFrame.background = background;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setExportFrameDpiScale: (scale) =>
      set((state) => {
        const clamped = Math.min(8, Math.max(0.25, scale));
        state.project.exportFrame.dpiScale = clamped;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    lockMapArea: (viewport, surfaceSize) =>
      set((state) => {
        if (surfaceSize && surfaceSize.width > 0 && surfaceSize.height > 0) {
          state.project.exportFrame.width = Math.round(surfaceSize.width);
          state.project.exportFrame.height = Math.round(surfaceSize.height);
          state.project.exportFrame.preset = 'custom';
        }
        state.project.viewport = viewport;
        state.project.mode = 'editing';
        state.project.lockedMapView = {
          viewport,
          exportFrame: {
            width: state.project.exportFrame.width,
            height: state.project.exportFrame.height,
          },
          basemap: state.project.basemap,
          lockedAt: new Date().toISOString(),
        };
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    unlockMapArea: () =>
      set((state) => {
        state.project.mode = 'mapSetup';
        state.selectedAnnotationId = null;
        state.selectedAnnotationIds = [];
        state.selectedFeature = null;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    addLayer: (layer) =>
      set((state) => {
        if (state.project.mode !== 'editing') return;
        state.project.layers.push(layer);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        state.selectedLayerId = layer.id;
        state.selectedAnnotationId = null;
        state.selectedAnnotationIds = [];
      }),

    removeLayer: (id) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer?.locked) return;
        state.project.layers = state.project.layers.filter((l) => l.id !== id);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        if (state.selectedLayerId === id) state.selectedLayerId = null;
        if (state.selectedFeature?.layerId === id) state.selectedFeature = null;
      }),

    renameLayer: (id, name) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer && !layer.locked) {
          layer.name = name;
          state.project.meta.updatedAt = new Date().toISOString();
          state.dirty = true;
        }
      }),

    updateLayerStyle: (id, patch) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (!layer || layer.locked) return;
        layer.style = { ...layer.style, ...patch };
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setLayerVisible: (id, visible) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) {
          layer.visible = visible;
          state.project.meta.updatedAt = new Date().toISOString();
          state.dirty = true;
        }
      }),

    setLayerLocked: (id, locked) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) {
          layer.locked = locked;
          state.project.meta.updatedAt = new Date().toISOString();
          state.dirty = true;
        }
      }),

    moveLayer: (id, direction) =>
      set((state) => {
        const layers = state.project.layers;
        const index = layers.findIndex((l) => l.id === id);
        if (index === -1) return;
        if (layers[index].locked) return;
        const target = direction === 'up' ? index + 1 : index - 1;
        if (target < 0 || target >= layers.length) return;
        if (layers[target].locked) return;
        [layers[index], layers[target]] = [layers[target], layers[index]];
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    selectLayer: (id) =>
      set((state) => {
        state.selectedLayerId = id;
        if (id) {
          state.selectedAnnotationId = null;
          state.selectedAnnotationIds = [];
        }
      }),

    selectFeature: (feature) =>
      set((state) => {
        state.selectedFeature = feature;
        if (feature) {
          state.selectedAnnotationId = null;
          state.selectedAnnotationIds = [];
        }
      }),

    addAnnotation: (annotation) =>
      set((state) => {
        if (state.project.mode !== 'editing') return;
        state.project.annotations.push(annotation);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        state.selectedAnnotationId = annotation.id;
        state.selectedAnnotationIds = [annotation.id];
        state.selectedLayerId = null;
        state.selectedFeature = null;
      }),

    removeAnnotation: (id) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (annotation?.locked) return;
        state.project.annotations = state.project.annotations.filter((item) => item.id !== id);
        state.project.annotationGroups = state.project.annotationGroups
          .map((group) => ({
            ...group,
            annotationIds: group.annotationIds.filter((annotationId) => annotationId !== id),
          }))
          .filter((group) => group.annotationIds.length > 1);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        if (state.selectedAnnotationId === id) state.selectedAnnotationId = null;
        state.selectedAnnotationIds = state.selectedAnnotationIds.filter((item) => item !== id);
      }),

    renameAnnotation: (id, name) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation || annotation.locked) return;
        annotation.name = name;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    selectAnnotation: (id) =>
      set((state) => {
        state.selectedAnnotationId = id;
        state.selectedAnnotationIds = id ? [id] : [];
        if (id) {
          state.selectedLayerId = null;
          state.selectedFeature = null;
        }
      }),

    setSelectedAnnotations: (ids) =>
      set((state) => {
        const existing = new Set(state.project.annotations.map((item) => item.id));
        const next = [...new Set(ids)].filter((id) => existing.has(id));
        state.selectedAnnotationIds = next;
        state.selectedAnnotationId = next.at(-1) ?? null;
        if (next.length) {
          state.selectedLayerId = null;
          state.selectedFeature = null;
        }
      }),

    toggleAnnotationSelection: (id) =>
      set((state) => {
        if (!state.project.annotations.some((item) => item.id === id)) return;
        const selected = new Set(state.selectedAnnotationIds);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        const next = [...selected];
        state.selectedAnnotationIds = next;
        state.selectedAnnotationId = next.at(-1) ?? null;
        state.selectedLayerId = null;
        state.selectedFeature = null;
      }),

    updateAnnotation: (id, patch) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation || annotation.locked) return;
        const group = annotation.groupId
          ? state.project.annotationGroups.find((item) => item.id === annotation.groupId)
          : null;
        if (group?.locked) return;
        Object.assign(annotation, patch);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    moveAnnotations: (moves) =>
      set((state) => {
        let changed = false;
        for (const move of moves) {
          const annotation = state.project.annotations.find((item) => item.id === move.id);
          if (!annotation || annotation.locked) continue;
          const group = annotation.groupId
            ? state.project.annotationGroups.find((item) => item.id === annotation.groupId)
            : null;
          if (group?.locked) continue;
          annotation.position = move.position;
          if (move.geoAnchor !== undefined) annotation.geoAnchor = move.geoAnchor;
          changed = true;
        }
        if (!changed) return;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    updateAnnotationStyle: (id, patch) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation || annotation.locked) return;
        const group = annotation.groupId
          ? state.project.annotationGroups.find((item) => item.id === annotation.groupId)
          : null;
        if (group?.locked) return;
        annotation.style = { ...annotation.style, ...patch };
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    moveAnnotation: (id, direction) =>
      set((state) => {
        const annotations = state.project.annotations;
        const index = annotations.findIndex((item) => item.id === id);
        if (index === -1) return;
        const target = direction === 'up' ? index + 1 : index - 1;
        if (target < 0 || target >= annotations.length) return;
        [annotations[index], annotations[target]] = [annotations[target], annotations[index]];
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setAnnotationVisible: (id, visible) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation) return;
        annotation.visible = visible;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    setAnnotationLocked: (id, locked) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation) return;
        annotation.locked = locked;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    groupSelectedAnnotations: () =>
      set((state) => {
        const selected = state.selectedAnnotationIds.filter((id) =>
          state.project.annotations.some((annotation) => annotation.id === id && !annotation.locked),
        );
        if (selected.length < 2) return;
        const groupId = crypto.randomUUID();
        state.project.annotationGroups.push({
          id: groupId,
          name: `Group ${state.project.annotationGroups.length + 1}`,
          locked: false,
          annotationIds: selected,
        });
        for (const annotation of state.project.annotations) {
          if (selected.includes(annotation.id)) annotation.groupId = groupId;
        }
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    ungroupSelectedAnnotations: () =>
      set((state) => {
        const selectedGroupIds = new Set(
          state.project.annotations
            .filter((annotation) => state.selectedAnnotationIds.includes(annotation.id) && annotation.groupId)
            .map((annotation) => annotation.groupId as string),
        );
        if (selectedGroupIds.size === 0) return;
        state.project.annotationGroups = state.project.annotationGroups.filter(
          (group) => !selectedGroupIds.has(group.id),
        );
        for (const annotation of state.project.annotations) {
          if (annotation.groupId && selectedGroupIds.has(annotation.groupId)) {
            annotation.groupId = null;
          }
        }
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),
  })),
);

// Expose the document store on `window.__documentStore` so Playwright e2e
// specs can seed mutations directly (visual diff, history coverage, etc.).
// Production users see nothing — the symbol is undocumented and read-only-ish.
if (typeof window !== 'undefined') {
  (window as unknown as { __documentStore: typeof useDocumentStore }).__documentStore =
    useDocumentStore;
}
