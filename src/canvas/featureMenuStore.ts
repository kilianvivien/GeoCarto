import { create } from 'zustand';

/** A right-click context menu anchored to a clicked GeoJSON feature. */
export interface FeatureMenu {
  /** Viewport coordinates (clientX/clientY) for fixed positioning. */
  x: number;
  y: number;
  layerId: string;
  layerName: string;
  locked: boolean;
}

interface FeatureMenuState {
  menu: FeatureMenu | null;
  open: (menu: FeatureMenu) => void;
  close: () => void;
}

export const useFeatureMenuStore = create<FeatureMenuState>((set) => ({
  menu: null,
  open: (menu) => set({ menu }),
  close: () => set({ menu: null }),
}));
