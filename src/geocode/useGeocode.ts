import { useEffect, useRef, useState } from 'react';
import { photonProvider } from './photon';
import type { GeocodeResult } from './provider';

const DEBOUNCE_MS = 300;
const RESULT_LIMIT = 8;
const CACHE_SIZE = 20;

// Module-level so results survive across popover open/close within a session.
const queryCache = new Map<string, GeocodeResult[]>();

function cacheKey(query: string, lang: string): string {
  return `${lang}:${query.trim().toLowerCase()}`;
}

export interface UseGeocodeState {
  results: GeocodeResult[];
  loading: boolean;
  /** True when the last search failed (e.g. offline) — never surfaced as a toast storm. */
  error: boolean;
}

/** Debounced, abortable place search with a small in-memory result cache. */
export function useGeocode(query: string, lang: string, enabled: boolean): UseGeocodeState {
  const [state, setState] = useState<UseGeocodeState>({ results: [], loading: false, error: false });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const trimmed = query.trim();

    if (!enabled || !trimmed) {
      setState({ results: [], loading: false, error: false });
      return;
    }

    const key = cacheKey(trimmed, lang);
    const cached = queryCache.get(key);
    if (cached) {
      setState({ results: cached, loading: false, error: false });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: false }));
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(async () => {
      try {
        const results = await photonProvider.search(trimmed, {
          lang,
          limit: RESULT_LIMIT,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        queryCache.set(key, results);
        if (queryCache.size > CACHE_SIZE) {
          const oldest = queryCache.keys().next().value;
          if (oldest !== undefined) queryCache.delete(oldest);
        }
        setState({ results, loading: false, error: false });
      } catch (error) {
        if (controller.signal.aborted || (error as { name?: string }).name === 'AbortError') return;
        setState({ results: [], loading: false, error: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, lang, enabled]);

  return state;
}
