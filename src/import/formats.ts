import type { FeatureCollection } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import {
  GeoJsonImportError,
  detectGeometry,
  featureCollectionToLayer,
  importGeoJsonFile,
  toFeatureCollection,
  toImportError,
} from './geojson';
import { parseInBackground } from './importJob';
import { ImportParseError, readTable, type ParsedCollection } from './parse';
import { GEOCODE_ROW_LIMIT, geocodeTable, locationColumns } from './geocodeTable';
import { translate } from '@/i18n/useLocale';

/**
 * Supported import formats (Milestone 14). GeoJSON ships in Phase 1; the rest
 * are decoded by parsers that are lazy-loaded only when a matching file lands,
 * so their (sizeable) dependencies stay out of the initial bundle. GeoJSON,
 * TopoJSON, and Shapefile decode in a worker (see `importJob.ts`).
 */
export type ImportFormat = 'geojson' | 'topojson' | 'kml' | 'gpx' | 'shapefile' | 'csv';

const EXTENSION_FORMAT: Record<string, ImportFormat> = {
  geojson: 'geojson',
  json: 'geojson',
  topojson: 'topojson',
  kml: 'kml',
  gpx: 'gpx',
  zip: 'shapefile',
  shp: 'shapefile',
  csv: 'csv',
  tsv: 'csv',
};

/** File-picker `accept` string covering every supported import format. */
export const IMPORT_ACCEPT =
  '.geojson,.json,.topojson,.kml,.gpx,.zip,.shp,.csv,.tsv,application/geo+json,application/json,application/vnd.google-earth.kml+xml,application/gpx+xml,text/csv,text/tab-separated-values';

export function formatForFile(file: File): ImportFormat | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_FORMAT[ext] ?? null;
}

function baseName(file: File, ...exts: string[]): string {
  const pattern = new RegExp(`\\.(${exts.join('|')})$`, 'i');
  return file.name.replace(pattern, '') || translate('layer.defaultName');
}

function parseXml(text: string, file: File): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new GeoJsonImportError(translate('errors.notWellFormedXml', { file: file.name }));
  }
  return doc;
}

function ensureNonEmpty(fc: FeatureCollection, file: File): FeatureCollection {
  if (fc.features.length === 0) {
    throw new GeoJsonImportError(translate('errors.noFeatures', { file: file.name }));
  }
  return fc;
}

async function parseKmlGpx(file: File, format: 'kml' | 'gpx'): Promise<GeoJsonLayer[]> {
  const togeojson = await import('@tmcw/togeojson');
  const doc = parseXml(await file.text(), file);
  const fc = ensureNonEmpty(
    (format === 'kml' ? togeojson.kml(doc) : togeojson.gpx(doc)) as FeatureCollection,
    file,
  );
  return [featureCollectionToLayer(baseName(file, format), fc)];
}

export interface ImportOptions {
  /** Aborting cancels the import; the promise rejects with `ImportCancelledError`. */
  signal?: AbortSignal;
  /** Called with a user-facing remark about a successful import (rows left out, etc.). */
  onNote?: (message: string) => void;
  /** Called while a table's rows are being geocoded one by one. */
  onGeocodeProgress?: (done: number, total: number) => void;
}

/**
 * A CSV/TSV as a point layer. Latitude/longitude columns are used when the
 * table has them; otherwise its address or place-name columns are geocoded,
 * within `GEOCODE_ROW_LIMIT` rows.
 */
async function importTable(file: File, options: ImportOptions): Promise<GeoJsonLayer[]> {
  let collection: ParsedCollection;
  try {
    [collection] = await parseInBackground('csv', file, options.signal);
  } catch (error) {
    if (!(error instanceof ImportParseError) || error.code !== 'noCoordinateColumns') throw error;
    const table = await readTable(file);
    const columns = locationColumns(table);
    if (columns.length === 0) {
      throw new GeoJsonImportError(translate('errors.noCoordinateColumns', { file: file.name }));
    }
    if (table.rows.length > GEOCODE_ROW_LIMIT) {
      throw new GeoJsonImportError(
        translate('errors.geocodeLimit', { file: file.name, rows: table.rows.length, limit: GEOCODE_ROW_LIMIT }),
      );
    }
    collection = await geocodeTable(table, columns, { signal: options.signal, onProgress: options.onGeocodeProgress });
    if (collection.data.features.length === 0) {
      throw new GeoJsonImportError(translate('errors.geocodeNoMatch', { file: file.name }));
    }
  }
  if (collection.skippedRows) {
    options.onNote?.(translate('import.rowsSkipped', { file: file.name, count: collection.skippedRows }));
  }
  return [featureCollectionToLayer(baseName(file, 'csv', 'tsv'), collection.data)];
}

/** Parse any supported file into one or more ready-to-add GeoJSON layers. */
export async function importFileToLayers(file: File, options: ImportOptions = {}): Promise<GeoJsonLayer[]> {
  const { signal } = options;
  const format = formatForFile(file);
  switch (format) {
    case 'geojson':
      return [await importGeoJsonFile(file, signal)];
    case 'topojson':
    case 'shapefile':
      try {
        const collections = await parseInBackground(format, file, signal);
        const fallbackName =
          format === 'topojson' ? baseName(file, 'topojson', 'json') : baseName(file, 'zip', 'shp');
        return collections.map(({ name, data }) => featureCollectionToLayer(name ?? fallbackName, data));
      } catch (error) {
        throw toImportError(error, file.name);
      }
    case 'csv':
      try {
        return await importTable(file, options);
      } catch (error) {
        throw toImportError(error, file.name);
      }
    // KML/GPX decode through DOMParser, which only exists on the main thread.
    case 'kml':
      return parseKmlGpx(file, 'kml');
    case 'gpx':
      return parseKmlGpx(file, 'gpx');
    default:
      throw new GeoJsonImportError(translate('errors.unsupportedImportFormat', { file: file.name }));
  }
}

export { GeoJsonImportError, detectGeometry, toFeatureCollection };
