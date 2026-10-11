import type { Feature } from 'geojson';
import { photonProvider } from '@/geocode/photon';
import { useLocale } from '@/i18n/useLocale';
import type { CsvTable } from './csv';
import { ImportCancelledError } from './importJob';
import type { ParsedCollection } from './parse';
import { GEOCODE_ROW_LIMIT, locationColumns } from './tablePoints';

export { GEOCODE_ROW_LIMIT, locationColumns };

/** Pause between requests, so a batch never hammers the geocoder. */
const REQUEST_GAP_MS = 150;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new ImportCancelledError());
    });
  });

/**
 * Place a table's rows by looking each one up in the geocoder, for tables that
 * describe places in words instead of coordinates. Rows the geocoder cannot
 * find are counted in `skippedRows`. One request at a time, cancellable.
 */
export async function geocodeTable(
  table: CsvTable,
  columns: string[],
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<ParsedCollection> {
  const { signal, onProgress } = options;
  const lang = useLocale.getState().locale;
  const features: Feature[] = [];
  // Identical addresses are looked up once.
  const known = new Map<string, [number, number] | null>();

  for (const [index, row] of table.rows.entries()) {
    if (signal?.aborted) throw new ImportCancelledError();
    onProgress?.(index + 1, table.rows.length);
    const query = columns
      .map((column) => String(row[column] ?? '').trim())
      .filter(Boolean)
      .join(', ');
    if (!query) continue;

    if (!known.has(query)) {
      if (known.size > 0) await wait(REQUEST_GAP_MS, signal);
      try {
        const [match] = await photonProvider.search(query, {
          lang,
          limit: 1,
          signal: signal ?? new AbortController().signal,
        });
        known.set(query, match?.center ?? null);
      } catch {
        if (signal?.aborted) throw new ImportCancelledError();
        // A failed lookup skips its row; the batch carries on.
        known.set(query, null);
      }
    }
    const center = known.get(query);
    if (!center) continue;
    features.push({
      type: 'Feature',
      properties: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value])),
      geometry: { type: 'Point', coordinates: center },
    });
  }
  return { data: { type: 'FeatureCollection', features }, skippedRows: table.rows.length - features.length };
}
