import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createEmptyProject, type CartoProject, type GeoJsonLayer } from '@/project/cartoproj';

/** A feature picked on the map, surfaced in the attribute inspector. */
export interface SelectedFeature {
  layerId: string;
  properties: Record<string, unknown>;
}

interface DocumentState {
  project: CartoProject;
  /** Layer selected in the layer panel. */
  selectedLayerId: string | null;
  /** Feature clicked on the map. */
  selectedFeature: SelectedFeature | null;

  addLayer: (layer: GeoJsonLayer) => void;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  /** Reorder within the stack. `up` moves toward the front (drawn on top). */
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  selectLayer: (id: string | null) => void;
  selectFeature: (feature: SelectedFeature | null) => void;
}

/**
 * The project document store — authoritative state for all renderers (PRD §3).
 * MapLibre layer sync, the layer panel, and export all project from this.
 */
export const useDocumentStore = create<DocumentState>()(
  immer((set) => ({
    project: createEmptyProject(),
    selectedLayerId: null,
    selectedFeature: null,

    addLayer: (layer) =>
      set((state) => {
        state.project.layers.push(layer);
        state.project.meta.updatedAt = new Date().toISOString();
        state.selectedLayerId = layer.id;
      }),

    removeLayer: (id) =>
      set((state) => {
        state.project.layers = state.project.layers.filter((l) => l.id !== id);
        state.project.meta.updatedAt = new Date().toISOString();
        if (state.selectedLayerId === id) state.selectedLayerId = null;
        if (state.selectedFeature?.layerId === id) state.selectedFeature = null;
      }),

    renameLayer: (id, name) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) {
          layer.name = name;
          state.project.meta.updatedAt = new Date().toISOString();
        }
      }),

    setLayerVisible: (id, visible) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) layer.visible = visible;
      }),

    setLayerLocked: (id, locked) =>
      set((state) => {
        const layer = state.project.layers.find((l) => l.id === id);
        if (layer) layer.locked = locked;
      }),

    moveLayer: (id, direction) =>
      set((state) => {
        const layers = state.project.layers;
        const index = layers.findIndex((l) => l.id === id);
        if (index === -1) return;
        const target = direction === 'up' ? index + 1 : index - 1;
        if (target < 0 || target >= layers.length) return;
        [layers[index], layers[target]] = [layers[target], layers[index]];
        state.project.meta.updatedAt = new Date().toISOString();
      }),

    selectLayer: (id) =>
      set((state) => {
        state.selectedLayerId = id;
      }),

    selectFeature: (feature) =>
      set((state) => {
        state.selectedFeature = feature;
      }),
  })),
);
