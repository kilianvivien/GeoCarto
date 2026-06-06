import type { Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  explodeForEditing,
  recombineFromParts,
  type EditIndex,
  type ExplodedFeature,
} from './multiGeometry';
import type { EditTool } from '@/state/editStore';

/**
 * The terra-draw ↔ document bridge — a *controlled editor*. terra-draw keeps its
 * own internal geometry store, but this module never lets it become a parallel
 * source of truth: every user change is read back, recombined into the canonical
 * `FeatureCollection`, and pushed to the document store via `onCommit`. When the
 * document changes from outside the editor (undo/redo, feature delete), the host
 * calls `resync()` to rebuild terra-draw from canonical state.
 *
 * This file statically imports terra-draw; the host loads it with a dynamic
 * `import()` only when edit mode is first entered, so terra-draw stays out of the
 * initial bundle (the `bundle-budget` gate).
 */

const EDIT_MODES = new Set(['point', 'linestring', 'polygon']);
const COMMIT_DEBOUNCE_MS = 60;

function modeForTool(tool: EditTool): string {
  if (tool === 'select') return 'select';
  if (tool === 'point') return 'point';
  if (tool === 'line') return 'linestring';
  return 'polygon';
}

export interface VectorEditorHandle {
  /** Switch the active terra-draw mode (select / draw point / line / polygon). */
  setTool: (tool: EditTool) => void;
  /** Rebuild the editor from canonical state after an external document change. */
  resync: (data: FeatureCollection) => void;
  /** Tear down terra-draw and cancel any pending commit. */
  stop: () => void;
}

export function startVectorEditor(opts: {
  map: MapLibreMap;
  data: FeatureCollection;
  onCommit: (data: FeatureCollection) => void;
  onSelect: (canonicalId: string | number | null) => void;
}): VectorEditorHandle {
  const { map, data, onCommit, onSelect } = opts;

  let index: EditIndex = { parents: new Map(), partToParent: new Map() };
  let currentTool: EditTool = 'select';
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  // True while we push canonical state into terra-draw, so the change events that
  // emits don't echo back to the document as spurious commits / history steps.
  let suspended = false;

  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawPointMode(),
      new TerraDrawLineStringMode(),
      new TerraDrawPolygonMode(),
      new TerraDrawSelectMode({
        flags: {
          point: { feature: { draggable: true } },
          linestring: {
            feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
          },
          polygon: {
            feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
          },
        },
      }),
    ],
  });

  function load(fc: FeatureCollection): void {
    const exploded = explodeForEditing(fc);
    index = exploded.index;
    suspended = true;
    draw.clear();
    if (exploded.parts.length) {
      // ExplodedFeature always carries non-null properties (we inject `mode`); the
      // cast bridges geojson's nullable `properties` to terra-draw's stricter type.
      draw.addFeatures(exploded.parts as unknown as Parameters<typeof draw.addFeatures>[0]);
    }
    suspended = false;
  }

  function commitNow(): void {
    if (stopped) return;
    const snapshot = draw.getSnapshot() as unknown as ExplodedFeature[];
    // Keep only real editable features — known parts or freshly-drawn geometry —
    // so terra-draw's internal selection/midpoint helpers never leak into the doc.
    const parts = snapshot.filter(
      (f) =>
        index.partToParent.has(String(f.id)) ||
        EDIT_MODES.has(String((f.properties ?? {})['mode'])),
    );
    onCommit(recombineFromParts(parts, index));
  }

  function scheduleCommit(): void {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(commitNow, COMMIT_DEBOUNCE_MS);
  }

  draw.on('change', (_ids, type) => {
    // Skip our own programmatic loads and pure restyles.
    if (suspended || type === 'styling') return;
    scheduleCommit();
  });

  draw.on('select', (id) => {
    const parentKey = index.partToParent.get(String(id));
    const canonicalId =
      parentKey !== undefined ? (index.parents.get(parentKey)?.id ?? null) : id;
    onSelect(canonicalId ?? null);
  });

  draw.on('deselect', () => onSelect(null));

  draw.start();
  load(data);
  draw.setMode('select');

  return {
    setTool(tool) {
      currentTool = tool;
      draw.setMode(modeForTool(tool));
    },
    resync(next) {
      load(next);
      draw.setMode(modeForTool(currentTool));
    },
    stop() {
      stopped = true;
      if (commitTimer) clearTimeout(commitTimer);
      try {
        draw.stop();
      } catch {
        // Adapter may already be torn down if the map was removed first.
      }
    },
  };
}
