import { create } from 'zustand';

export type NoticeTone = 'info' | 'error';

export interface Notice {
  id: string;
  message: string;
  tone: NoticeTone;
}

interface NoticeState {
  notices: Notice[];
  push: (message: string, tone?: NoticeTone) => void;
  dismiss: (id: string) => void;
}

const DISMISS_MS = 3500;

/** Transient toast notifications (design.md §6d), lean Phase 1 version. */
export const useNotices = create<NoticeState>((set, get) => ({
  notices: [],
  push: (message, tone = 'info') => {
    const id = crypto.randomUUID();
    set((state) => ({ notices: [...state.notices, { id, message, tone }] }));
    setTimeout(() => get().dismiss(id), DISMISS_MS);
  },
  dismiss: (id) => set((state) => ({ notices: state.notices.filter((n) => n.id !== id) })),
}));
