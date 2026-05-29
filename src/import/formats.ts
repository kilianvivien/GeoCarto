import type { FeatureCollection } from 'geojson';
import type { GeoJsonLayer } from '@/project/cartoproj';
import {
  GeoJsonImportError,
  detectGeometry,
  featureCollectionToLayer,
  importGeoJsonFile,
  toFeatureCollection,
} from './geojson';

/**
 * Supported import formats (Milestone 14). GeoJSON ships in Phase 1; the rest
 * are decoded by parsers that are lazy-loaded only when a matching file lands,
 * so their (sizeable) dependencies stay out of the initial bundle.
 */
export type ImportFormat = 'geojson' | 'topojson' | 'kml' | 'gpx' | 'shapefile';

const EXTENSION_FORMAT: Record<string, ImportFormat> = {
  geojson: 'geojson',
  json: 'geojson',
  topojson: 'topojson',
  kml: 'kml',
  gpx: 'gpx',
  zip: 'shapefile',
  shp: 'shapefile',
};

/** File-picker `accept` string covering every supported import format. */
export const IMPORT_ACCEPT =
  '.geojson,.json,.topojson,.kml,.gpx,.zip,.shp,application/geo+json,application/json,application/vnd.google-earth.kml+xml,application/gpx+xml';

export function formatForFile(file: File): ImportFormat | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_FORMAT[ext] ?? null;
}

function baseName(file: File, ...exts: string[]): string {
  const pattern = new RegExp(`\\.(${exts.join('|')})$`, 'i');
  return file.name.replace(pattern, '') || 'Layer';
}

function parseXml(text: string, file: File): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new GeoJsonImportError(`"${file.name}" is not well-formed XML.`);
  }
  return doc;
}

function ensureNonEmpty(fc: FeatureCollection, file: File): FeatureCollection {
  if (fc.features.length === 0) {
    throw new GeoJsonImportError(`"${file.name}" contains no features.`);
  }
  return fc;
}

async function parseTopoJson(file: File): Promise<GeoJsonLayer[]> {
  const { feature } = await import('topojson-client');
  let topology: unknown;
  try {
    topology = JSON.parse(await file.text());
  } catch {
    throw new GeoJsonImportError(`"${file.name}" is not valid JSON.`);
  }
  const objects = (topology as { objects?: Record<string, unknown> }).objects;
  if (!objects || typeof objects !== 'object') {
    throw new GeoJsonImportError(`"${file.name}" has no TopoJSON objects.`);
  }
  // Merge every object into one collection so a file maps to a single layer,
  // matching how the other formats behave.
  const features = Object.values(objects).flatMap((object) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = feature(topology as any, object as any) as unknown as
      | import('geojson').Feature
      | FeatureCollection;
    return result.type === 'FeatureCollection' ? result.features : [result];
  });
  const fc = ensureNonEmpty({ type: 'FeatureCollection', features }, file);
  return [featureCollectionToLayer(baseName(file, 'topojson', 'json'), fc)];
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

async function parseShapefile(file: File): Promise<GeoJsonLayer[]> {
  const shp = (await import('shpjs')).default;
  const buffer = await file.arrayBuffer();
  let result: FeatureCollection | FeatureCollection[];
  try {
    // shpjs reprojects from the bundled .prj to WGS84 and returns one
    // FeatureCollection per .shp found in the zip.
    result = (await shp(buffer)) as FeatureCollection | FeatureCollection[];
  } catch (error) {
    throw new GeoJsonImportError(
      `Could not read shapefile "${file.name}": ${(error as Error).message}`,
    );
  }
  const collections = Array.isArray(result) ? result : [result];
  const layers = collections
    .filter((fc) => fc.features.length > 0)
    .map((fc) => {
      const name = (fc as { fileName?: string }).fileName ?? baseName(file, 'zip', 'shp');
      return featureCollectionToLayer(name, fc);
    });
  if (layers.length === 0) {
    throw new GeoJsonImportError(`"${file.name}" contains no shapefile features.`);
  }
  return layers;
}

/** Parse any supported file into one or more ready-to-add GeoJSON layers. */
export async function importFileToLayers(file: File): Promise<GeoJsonLayer[]> {
  const format = formatForFile(file);
  switch (format) {
    case 'geojson':
      return [await importGeoJsonFile(file)];
    case 'topojson':
      return parseTopoJson(file);
    case 'kml':
      return parseKmlGpx(file, 'kml');
    case 'gpx':
      return parseKmlGpx(file, 'gpx');
    case 'shapefile':
      return parseShapefile(file);
    default:
      throw new GeoJsonImportError(
        `"${file.name}" is not a supported format (GeoJSON, TopoJSON, KML, GPX, or zipped Shapefile).`,
      );
  }
}

export { GeoJsonImportError, detectGeometry, toFeatureCollection };
