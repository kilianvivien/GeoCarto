import { create } from 'zustand';

interface UiState {
  exportDialogOpen: boolean;
  settingsDialogOpen: boolean;
  commandPaletteOpen: boolean;
  pendingLegendFillSample: { legendId: string; entryIndex: number } | null;
  pendingAnnotationFillSample: { annotationId: string } | null;
  openExportDialog: () => void;
  closeExportDialog: () => void;
  openSettingsDialog: () => void;
  closeSettingsDialog: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  startLegendFillSample: (legendId: string, entryIndex: number) => void;
  cancelLegendFillSample: () => void;
  startAnnotationFillSample: (annotationId: string) => void;
  cancelAnnotationFillSample: () => void;
  cancelFillSample: () => void;
}

/** Ephemeral UI state (transient dialogs, etc.) — not persisted. */
export const useUiStore = create<UiState>((set) => ({
  exportDialogOpen: false,
  settingsDialogOpen: false,
  commandPaletteOpen: false,
  pendingLegendFillSample: null,
  pendingAnnotationFillSample: null,
  openExportDialog: () => set({ exportDialogOpen: true }),
  closeExportDialog: () => set({ exportDialogOpen: false }),
  openSettingsDialog: () => set({ settingsDialogOpen: true }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  startLegendFillSample: (legendId, entryIndex) =>
    set({ pendingLegendFillSample: { legendId, entryIndex }, pendingAnnotationFillSample: null }),
  cancelLegendFillSample: () => set({ pendingLegendFillSample: null }),
  startAnnotationFillSample: (annotationId) =>
    set({ pendingAnnotationFillSample: { annotationId }, pendingLegendFillSample: null }),
  cancelAnnotationFillSample: () => set({ pendingAnnotationFillSample: null }),
  cancelFillSample: () => set({ pendingLegendFillSample: null, pendingAnnotationFillSample: null }),
}));
