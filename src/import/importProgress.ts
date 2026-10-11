import { create } from 'zustand';

interface ImportProgressState {
  /** The file being decoded, with its 1-based position in the batch. */
  current: { file: string; index: number; total: number; geocoding?: { done: number; total: number } } | null;
  /** Cancels the running batch; null when nothing is importing. */
  cancel: (() => void) | null;
}

/** Live status of the running import batch, shown as a cancellable toast. */
export const useImportProgress = create<ImportProgressState>(() => ({ current: null, cancel: null }));
