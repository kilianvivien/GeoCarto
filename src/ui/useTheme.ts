import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'geocarto-theme';

function safeSet(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* sandboxed browsers throw on localStorage — ignore */
  }
}

function initialTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

interface ThemeState {
  theme: Theme;
  setTheme: (next: Theme) => void;
  toggleTheme: () => void;
}

/**
 * Theme state. The bootstrap script in index.html sets `data-theme` before
 * paint; this store keeps React in sync and writes changes back to the DOM.
 */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (next) => {
    document.documentElement.setAttribute('data-theme', next);
    safeSet(next);
    set({ theme: next });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
