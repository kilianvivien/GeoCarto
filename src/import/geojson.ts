import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { DEFAULT_GEOJSON_STYLE, type GeoJsonLayer, type GeometryKind } from '@/project/cartoproj';

/** Raised when a file cannot be read as usable GeoJSON. Message is user-facing. */
export class GeoJsonImportError extends Error {}

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
export function toFeatureCollection(raw: unknown): FeatureCollection {
  if (!raw || typeof raw !== 'object') {
    throw new GeoJsonImportError('File is not a GeoJSON object.');
  }
  const type = (raw as { type?: unknown }).type;
  if (type === 'FeatureCollection') return raw as FeatureCollection;
  if (type === 'Feature') {
    return { type: 'FeatureCollection', features: [raw as Feature] };
  }
  if (typeof type === 'string' && GEOMETRY_TYPES.has(type)) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: raw as Geometry, properties: {} }],
    };
  }
  throw new GeoJsonImportError(
    'Unrecognized GeoJSON — expected a FeatureCollection, Feature, or geometry.',
  );
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
  return {
    id: crypto.randomUUID(),
    kind: 'geojson',
    name: name || 'Layer',
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
export async function importGeoJsonFile(file: File): Promise<GeoJsonLayer> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeoJsonImportError(`"${file.name}" is not valid JSON.`);
  }
  const data = toFeatureCollection(parsed);
  if (data.features.length === 0) {
    throw new GeoJsonImportError(`"${file.name}" contains no features.`);
  }
  return featureCollectionToLayer(file.name.replace(/\.(geo)?json$/i, ''), data);
}
