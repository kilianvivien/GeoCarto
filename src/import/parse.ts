import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { CsvParseError, parseCsv, type CsvTable } from './csv';
import { coordinateColumns, pointsFromTable } from './tablePoints';

/**
 * Format decoders shared by the import worker and its main-thread fallback.
 * Everything here must stay worker-safe: no DOM, no stores, no i18n — failures
 * are reported as codes and turned into user-facing messages on the main thread.
 */
export type ParseErrorCode =
  | 'notValidJson'
  | 'notGeoJsonObject'
  | 'unrecognizedGeoJson'
  | 'noFeatures'
  | 'noTopoJson'
  | 'shapefileRead'
  | 'noShapefileFeatures'
  | 'csvUnreadable'
  | 'noCoordinateColumns'
  | 'noValidCoordinates';

export class ImportParseError extends Error {
  constructor(
    readonly code: ParseErrorCode,
    readonly detail = '',
  ) {
    super(code);
    this.name = 'ImportParseError';
  }
}

/** One decoded dataset; `name` is set when the file itself names it (zipped shapefiles). */
export interface ParsedCollection {
  name?: string;
  data: FeatureCollection;
  /** Table rows left out because they had no usable position. */
  skippedRows?: number;
}

/** Formats decoded off the main thread. KML/GPX need a DOM parser, which workers lack. */
export type WorkerFormat = 'geojson' | 'topojson' | 'shapefile' | 'csv';

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
]);

/** Accept a FeatureCollection, a bare Feature, or a geometry; normalize to a FC. */
export function normalizeToFeatureCollection(raw: unknown): FeatureCollection {
  if (!raw || typeof raw !== 'object') throw new ImportParseError('notGeoJsonObject');
  const type = (raw as { type?: unknown }).type;
  if (type === 'FeatureCollection') return raw as FeatureCollection;
  if (type === 'Feature') return { type: 'FeatureCollection', features: [raw as Feature] };
  if (typeof type === 'string' && GEOMETRY_TYPES.has(type)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: raw as Geometry, properties: {} }],
    };
  }
  throw new ImportParseError('unrecognizedGeoJson');
}

async function readJson(file: Blob): Promise<unknown> {
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new ImportParseError('notValidJson');
  }
}

async function parseGeoJson(file: Blob): Promise<ParsedCollection[]> {
  const data = normalizeToFeatureCollection(await readJson(file));
  if (data.features.length === 0) throw new ImportParseError('noFeatures');
  return [{ data }];
}

async function parseTopoJson(file: Blob): Promise<ParsedCollection[]> {
  const { feature } = await import('topojson-client');
  const topology = await readJson(file);
  const objects = (topology as { objects?: Record<string, unknown> } | null)?.objects;
  if (!objects || typeof objects !== 'object') throw new ImportParseError('noTopoJson');
  // Merge every object into one collection so a file maps to a single layer,
  // matching how the other formats behave.
  const features = Object.values(objects).flatMap((object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = feature(topology as any, object as any) as unknown as Feature | FeatureCollection;
    return result.type === 'FeatureCollection' ? result.features : [result];
  });
  if (features.length === 0) throw new ImportParseError('noFeatures');
  return [{ data: { type: 'FeatureCollection', features } }];
}

async function parseShapefile(file: Blob): Promise<ParsedCollection[]> {
  const shp = (await import('shpjs')).default;
  const buffer = await file.arrayBuffer();
  let result: FeatureCollection | FeatureCollection[];
  try {
    // shpjs reprojects from the bundled .prj to WGS84 and returns one
    // FeatureCollection per .shp found in the zip.
    result = (await shp(buffer)) as FeatureCollection | FeatureCollection[];
  } catch (error) {
    throw new ImportParseError('shapefileRead', (error as Error).message);
  }
  const collections = (Array.isArray(result) ? result : [result])
    .filter((fc) => fc.features.length > 0)
    .map((fc) => ({
      name: (fc as { fileName?: string }).fileName,
      // Drop shpjs' extra `fileName` field so the layer holds plain GeoJSON.
      data: { type: 'FeatureCollection', features: fc.features } satisfies FeatureCollection,
    }));
  if (collections.length === 0) throw new ImportParseError('noShapefileFeatures');
  return collections;
}

/**
 * Turn a table with latitude/longitude columns into point features, reporting
 * a table that cannot be placed as an import error.
 */
export function tableToPoints(table: CsvTable): ParsedCollection {
  if (!coordinateColumns(table)) throw new ImportParseError('noCoordinateColumns');
  const { features, skippedRows } = pointsFromTable(table);
  if (features.length === 0) throw new ImportParseError('noValidCoordinates');
  return { data: { type: 'FeatureCollection', features }, skippedRows };
}

export { coordinateColumns };

/** Read a CSV/TSV file as a table, reporting an unreadable one as an import error. */
export async function readTable(file: Blob): Promise<CsvTable> {
  try {
    return parseCsv(await file.text());
  } catch (error) {
    if (error instanceof CsvParseError) throw new ImportParseError('csvUnreadable');
    throw error;
  }
}

export function parseFile(format: WorkerFormat, file: Blob): Promise<ParsedCollection[]> {
  if (format === 'csv') return readTable(file).then((table) => [tableToPoints(table)]);
  if (format === 'topojson') return parseTopoJson(file);
  if (format === 'shapefile') return parseShapefile(file);
  return parseGeoJson(file);
}
