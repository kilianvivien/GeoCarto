import { useEffect, useRef } from 'react';
import type { FeatureCollection } from 'geojson';
import { useDocumentStore } from '@/state/documentStore';
import { useEditStore } from '@/state/editStore';
import { hintHistoryLabel } from '@/state/historyStore';
import { useMapInstance } from './mapInstance';
import type { VectorEditorHandle } from '@/tools/vectorEditor';

/**
 * Headless host for the terra-draw vector editor. Mounted beside `GeoJsonLayers`,
 * it owns the editor's lifecycle: it lazily loads terra-draw when a layer is opened
 * for editing, commits geometry changes back into the document, and re-syncs the
 * editor when the document changes from outside (undo/redo, feature delete). It
 * holds no authoritative state — the `.cartoproj` document remains the source of
 * truth (CLAUDE.md invariant).
 */

/**
 * True when geometry (not just properties) differs between two collections.
 * Immer structurally shares untouched subtrees, so an attribute-only edit keeps
 * each feature's `geometry` reference — letting us skip a disruptive editor rebuild
 * and resync only on real geometry changes (undo/redo, deletes).
 */
function geometryChanged(prev: FeatureCollection | null, next: FeatureCollection): boolean {
  if (!prev) return true;
  if (prev.features.length !== next.features.length) return true;
  const byId = new Map(prev.features.map((f) => [f.id, f.geometry]));
  for (const feature of next.features) {
    if (!byId.has(feature.id)) return true;
    if (byId.get(feature.id) !== feature.geometry) return true;
  }
  return false;
}

export function VectorEditor() {
  const map = useMapInstance((s) => s.map);
  const editingLayerId = useEditStore((s) => s.editingLayerId);
  const activeTool = useEditStore((s) => s.activeTool);

  const handleRef = useRef<VectorEditorHandle | null>(null);
  const lastSyncedRef = useRef<FeatureCollection | null>(null);

  useEffect(() => {
    if (!map || !editingLayerId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const layer = useDocumentStore.getState().project.layers.find((l) => l.id === editingLayerId);
      if (!layer || layer.locked) {
        useEditStore.getState().exitEdit();
        return;
      }
      const mod = await import('@/tools/vectorEditor');
      if (cancelled) return;

      handleRef.current = mod.startVectorEditor({
        map,
        data: layer.data,
        onCommit: (fc) => {
          lastSyncedRef.current = fc;
          hintHistoryLabel('Edit feature geometry');
          useDocumentStore.getState().commitLayerFeatures(editingLayerId, fc);
        },
        onSelect: (id) => useEditStore.getState().selectFeature(id),
      });
      lastSyncedRef.current = layer.data;
      handleRef.current.setTool(useEditStore.getState().activeTool);

      // Mirror external document changes (undo/redo, delete) back into terra-draw,
      // and bail out of edit mode if the layer is removed or locked elsewhere.
      unsubscribe = useDocumentStore.subscribe((state) => {
        const current = state.project.layers.find((l) => l.id === editingLayerId);
        if (!current || current.locked) {
          useEditStore.getState().exitEdit();
          return;
        }
        const data = current.data;
        if (data === lastSyncedRef.current) return; // our own commit echoing back
        if (!geometryChanged(lastSyncedRef.current, data)) {
          lastSyncedRef.current = data; // attribute-only change; nothing to rebuild
          return;
        }
        lastSyncedRef.current = data;
        handleRef.current?.resync(data);
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      handleRef.current?.stop();
      handleRef.current = null;
      lastSyncedRef.current = null;
    };
  }, [map, editingLayerId]);

  useEffect(() => {
    handleRef.current?.setTool(activeTool);
  }, [activeTool]);

  return null;
}
