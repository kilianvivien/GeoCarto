import { create } from 'zustand';

interface UiState {
  exportDialogOpen: boolean;
  openExportDialog: () => void;
  closeExportDialog: () => void;
}

/** Ephemeral UI state (transient dialogs, etc.) — not persisted. */
export const useUiStore = create<UiState>((set) => ({
  exportDialogOpen: false,
  openExportDialog: () => set({ exportDialogOpen: true }),
  closeExportDialog: () => set({ exportDialogOpen: false }),
}));
