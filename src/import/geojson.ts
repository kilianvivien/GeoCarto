import type { FeatureCollection } from 'geojson';
import { DEFAULT_GEOJSON_STYLE, type GeoJsonLayer, type GeometryKind } from '@/project/cartoproj';
import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';
import { translate } from '@/i18n/useLocale';
import { parseInBackground } from './importJob';
import { ImportParseError, normalizeToFeatureCollection } from './parse';

/**
 * Give every feature a stable identity: a top-level `id` (so the vector editor can
 * address it) and an `@id` property (the per-feature fill key). Done at import so
 * shapes are individually styleable and editable out of the box — no manual ID
 * wrangling. Returns whether anything changed. Mutates in place.
 */
export function ensureFeatureIdentity(fc: FeatureCollection): boolean {
  let changed = false;
  for (const feature of fc.features) {
    if (feature.id === undefined || feature.id === null) {
      feature.id = crypto.randomUUID();
      changed = true;
    }
    if (feature.properties === null || feature.properties === undefined) {
      feature.properties = {};
    }
    if (!feature.properties[FEATURE_FILL_PROPERTY]) {
      feature.properties[FEATURE_FILL_PROPERTY] = String(feature.id);
      changed = true;
    }
  }
  return changed;
}

/** Raised when a file cannot be read as usable GeoJSON. Message is user-facing. */
export class GeoJsonImportError extends Error {}

/** Accept a FeatureCollection, a bare Feature, or a geometry; normalize to a FC. */
export function toFeatureCollection(raw: unknown): FeatureCollection {
  try {
    return normalizeToFeatureCollection(raw);
  } catch (error) {
    throw toImportError(error, '');
  }
}

/** Turn a decoder failure into the user-facing error the import UI reports. */
export function toImportError(error: unknown, fileName: string): unknown {
  if (!(error instanceof ImportParseError)) return error;
  return new GeoJsonImportError(translate(`errors.${error.code}`, { file: fileName, error: error.detail }));
}

function familyOf(geometryType: string): GeometryKind | null {
  if (geometryType === 'Point' || geometryType === 'MultiPoint') return 'point';
  if (geometryType === 'LineString' || geometryType === 'MultiLineString') return 'line';
  if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') return 'polygon';
  return null;
}

function hasPolygonGeometry(fc: FeatureCollection): boolean {
  return fc.features.some((feature) => {
    if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') return true;
    if (feature.geometry?.type !== 'GeometryCollection') return false;
    return feature.geometry.geometries.some(
      (geometry) => geometry.type === 'Polygon' || geometry.type === 'MultiPolygon',
    );
  });
}

/** Classify a collection as point / line / polygon, or mixed when it spans families. */
export function detectGeometry(fc: FeatureCollection): GeometryKind {
  const families = new Set<GeometryKind>();
  for (const feature of fc.features) {
    const family = feature.geometry ? familyOf(feature.geometry.type) : null;
    if (family) families.add(family);
    else if (feature.geometry?.type === 'GeometryCollection') return 'mixed';
  }
  return families.size === 1 ? [...families][0] : 'mixed';
}

/** Wrap a normalized FeatureCollection in a ready-to-add GeoJSON layer. */
export function featureCollectionToLayer(name: string, data: FeatureCollection): GeoJsonLayer {
  ensureFeatureIdentity(data);
  return {
    id: crypto.randomUUID(),
    kind: 'geojson',
    name: name || translate('layer.defaultName'),
    visible: true,
    locked: false,
    geometry: detectGeometry(data),
    featureCount: data.features.length,
    data,
    style: {
      ...DEFAULT_GEOJSON_STYLE,
      // OSM exports often mix admin-boundary polygons with admin-centre points.
      // Default those to clean province/region shapes; users can re-enable points.
      showPoints: !hasPolygonGeometry(data),
    },
  };
}

/** Parse a dropped/picked file into a ready-to-add GeoJSON layer. */
export async function importGeoJsonFile(file: File, signal?: AbortSignal): Promise<GeoJsonLayer> {
  try {
    const [{ data }] = await parseInBackground('geojson', file, signal);
    return featureCollectionToLayer(file.name.replace(/\.(geo)?json$/i, ''), data);
  } catch (error) {
    throw toImportError(error, file.name);
  }
}
