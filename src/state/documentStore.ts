import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createEmptyProject,
  type Annotation,
  type AnnotationStyle,
  type BasemapConfig,
  type CartoProject,
  type GeoJsonLayer,
  type GeoJsonStyle,
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
  setExportFrame: (frame: { width: number; height: number }) => void;
  lockMapArea: (viewport: Viewport) => void;
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
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  updateAnnotationStyle: (id: string, patch: Partial<AnnotationStyle>) => void;
  moveAnnotation: (id: string, direction: 'up' | 'down') => void;
  setAnnotationVisible: (id: string, visible: boolean) => void;
  setAnnotationLocked: (id: string, locked: boolean) => void;
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
    selectedFeature: null,
    dirty: false,
    file: null,

    replaceProject: (project, file) =>
      set((state) => {
        state.project = project;
        state.selectedLayerId = null;
        state.selectedAnnotationId = null;
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

    setExportFrame: (frame) =>
      set((state) => {
        state.project.exportFrame = frame;
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    lockMapArea: (viewport) =>
      set((state) => {
        state.project.viewport = viewport;
        state.project.mode = 'editing';
        state.project.lockedMapView = {
          viewport,
          exportFrame: { ...state.project.exportFrame },
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
        if (id) state.selectedAnnotationId = null;
      }),

    selectFeature: (feature) =>
      set((state) => {
        state.selectedFeature = feature;
        if (feature) state.selectedAnnotationId = null;
      }),

    addAnnotation: (annotation) =>
      set((state) => {
        if (state.project.mode !== 'editing') return;
        state.project.annotations.push(annotation);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        state.selectedAnnotationId = annotation.id;
        state.selectedLayerId = null;
        state.selectedFeature = null;
      }),

    removeAnnotation: (id) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (annotation?.locked) return;
        state.project.annotations = state.project.annotations.filter((item) => item.id !== id);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
        if (state.selectedAnnotationId === id) state.selectedAnnotationId = null;
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
        if (id) {
          state.selectedLayerId = null;
          state.selectedFeature = null;
        }
      }),

    updateAnnotation: (id, patch) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation || annotation.locked) return;
        Object.assign(annotation, patch);
        state.project.meta.updatedAt = new Date().toISOString();
        state.dirty = true;
      }),

    updateAnnotationStyle: (id, patch) =>
      set((state) => {
        const annotation = state.project.annotations.find((item) => item.id === id);
        if (!annotation || annotation.locked) return;
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
  })),
);

// Expose the document store on `window.__documentStore` so Playwright e2e
// specs can seed mutations directly (visual diff, history coverage, etc.).
// Production users see nothing — the symbol is undocumented and read-only-ish.
if (typeof window !== 'undefined') {
  (window as unknown as { __documentStore: typeof useDocumentStore }).__documentStore =
    useDocumentStore;
}
