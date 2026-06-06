import { create } from 'zustand';
import { hintHistoryLabel } from './historyStore';
import { useDocumentStore } from './documentStore';

/** The single-geometry sub-tools available inside vector edit mode. */
export type EditTool = 'select' | 'point' | 'line' | 'polygon' | 'rectangle' | 'circle';

/**
 * Vector edit-mode session state. This is pure UI/session state — like the tool
 * and selection stores it lives *outside* the document (PRD §3), so it is never
 * captured by history. The authoritative geometry lives in the document's
 * `FeatureCollection`; this store only tracks which layer is being edited, the
 * active sub-tool, and which feature is selected for attribute editing.
 */
interface EditState {
  /** The layer currently open for vector editing, or null when not editing. */
  editingLayerId: string | null;
  activeTool: EditTool;
  /** Feature picked inside the editor, addressed by its stable top-level id. */
  selectedFeatureId: string | number | null;
  enterEdit: (layerId: string) => void;
  exitEdit: () => void;
  setTool: (tool: EditTool) => void;
  selectFeature: (featureId: string | number | null) => void;
}

export const useEditStore = create<EditState>((set) => ({
  editingLayerId: null,
  activeTool: 'select',
  selectedFeatureId: null,

  enterEdit: (layerId) => {
    const layer = useDocumentStore.getState().project.layers.find((l) => l.id === layerId);
    if (!layer || layer.locked) return;
    // Stamp stable ids so the editor↔document bridge can address each feature.
    hintHistoryLabel('Prepare layer for editing');
    useDocumentStore.getState().ensureFeatureIds(layerId);
    // Yield the read-only feature inspector and focus the layer being edited.
    useDocumentStore.getState().selectFeature(null);
    useDocumentStore.getState().selectLayer(layerId);
    set({ editingLayerId: layerId, activeTool: 'select', selectedFeatureId: null });
  },

  exitEdit: () => set({ editingLayerId: null, activeTool: 'select', selectedFeatureId: null }),

  setTool: (activeTool) => set({ activeTool }),

  selectFeature: (selectedFeatureId) => set({ selectedFeatureId }),
}));

// Exposed for Playwright e2e specs (and manual smoke tests) so edit mode can be
// driven directly, mirroring `window.__documentStore`. Undocumented in production.
if (typeof window !== 'undefined') {
  (window as unknown as { __editStore: typeof useEditStore }).__editStore = useEditStore;
}
