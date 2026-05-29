import { useDocumentStore } from '@/state/documentStore';
import { useToolStore } from '@/state/toolStore';
import { useMapInstance } from '@/canvas/mapInstance';
import { createAnnotation } from './annotationFactory';

/** Map-furniture kinds offered by the Insert menu (Milestone 13). */
export type FurnitureKind = 'titleblock' | 'sourcecredit' | 'scalebar' | 'northarrow';

/**
 * Drop a furniture annotation onto the canvas at a sensible default corner and
 * select it. Furniture is screen-anchored so it stays put as the map pans.
 */
export function insertFurniture(kind: FurnitureKind): void {
  const container = useMapInstance.getState().map?.getContainer();
  const w = container?.clientWidth ?? 800;
  const h = container?.clientHeight ?? 600;
  const positions: Record<FurnitureKind, { x: number; y: number }> = {
    titleblock: { x: 44, y: 40 },
    northarrow: { x: w - 96, y: 48 },
    scalebar: { x: 44, y: h - 78 },
    sourcecredit: { x: 44, y: h - 42 },
  };
  const annotation = createAnnotation({
    kind,
    anchorMode: 'canvas',
    position: positions[kind],
    geoAnchor: null,
    style: useToolStore.getState().defaultStyle,
  });
  useDocumentStore.getState().addAnnotation(annotation);
}
