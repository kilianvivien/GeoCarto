import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';

/**
 * terra-draw only accepts single Point / LineString / Polygon geometries — its
 * store rejects Multi* types ("must be broken down programmatically"). Real
 * imported data (départements, shapefiles) is frequently MultiPolygon, so we
 * *explode* each canonical feature into the single-part geometries terra-draw
 * can edit, then *recombine* the parts back into the original Multi* shape on
 * commit. This preserves feature identity and `featureCount`: editing a
 * département keeps it one feature, not many.
 *
 * The canonical `FeatureCollection` (the `.cartoproj` source of truth) is never
 * handed to terra-draw directly; only the exploded parts are. Recombination is
 * driven by an `EditIndex` built at explode time, never by trusting terra-draw
 * to preserve our bookkeeping properties.
 */

import { FEATURE_FILL_PROPERTY } from '@/layers/geojsonFeatureStyle';

/** terra-draw mode names for the single editable geometry families. */
export type EditableMode = 'point' | 'linestring' | 'polygon';

/** The single property terra-draw requires on every feature: its mode. */
export const MODE_PROPERTY = 'mode';

type MultiType = 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
type SingleGeometry = Point | LineString | Polygon;

/** A terra-draw-ready feature: a single geometry with a UUID id and `mode`. */
export interface ExplodedFeature extends Feature {
  id: string;
  geometry: SingleGeometry;
}

interface ParentMeta {
  /** Original canonical feature id (preserved verbatim, may be string or number). */
  id: string | number;
  /** Set when the original geometry was a Multi*; null when it was single-part. */
  multiType: MultiType | null;
  /** Original feature properties — reapplied on recombine (terra-draw never owns them). */
  properties: GeoJsonProperties;
  /** terra-draw part ids in original part order, used to re-order on recombine. */
  partIds: string[];
  /** Original geometry for features terra-draw can't edit (null / GeometryCollection). */
  passthroughGeometry: Geometry | null;
}

/** Built at explode time; the authoritative map for recombination. */
export interface EditIndex {
  /** Keyed by `String(feature.id)`. */
  parents: Map<string, ParentMeta>;
  /** terra-draw part id → parent key. Absent ⇒ a feature drawn fresh in terra-draw. */
  partToParent: Map<string, string>;
}

function modeForGeometry(type: SingleGeometry['type']): EditableMode {
  if (type === 'Point') return 'point';
  if (type === 'LineString') return 'linestring';
  return 'polygon';
}

function multiTypeOf(type: Geometry['type']): MultiType | null {
  if (type === 'MultiPoint' || type === 'MultiLineString' || type === 'MultiPolygon') return type;
  return null;
}

/** Break any geometry into the single-part geometries terra-draw can edit. */
function singleGeometriesOf(geometry: Geometry): SingleGeometry[] {
  switch (geometry.type) {
    case 'Point':
    case 'LineString':
    case 'Polygon':
      return [geometry];
    case 'MultiPoint':
      return geometry.coordinates.map((coordinates) => ({ type: 'Point', coordinates }));
    case 'MultiLineString':
      return geometry.coordinates.map((coordinates) => ({ type: 'LineString', coordinates }));
    case 'MultiPolygon':
      return geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));
    default:
      // GeometryCollection (or anything unexpected): not editable, pass through.
      return [];
  }
}

/**
 * Explode a canonical `FeatureCollection` into terra-draw-ready single-part
 * features plus the `EditIndex` needed to put them back together. Every part
 * gets a fresh UUID id so terra-draw's default id validation always passes,
 * regardless of the original feature id's shape (numeric, code, missing).
 */
export function explodeForEditing(fc: FeatureCollection): {
  parts: ExplodedFeature[];
  index: EditIndex;
} {
  const parts: ExplodedFeature[] = [];
  const parents = new Map<string, ParentMeta>();
  const partToParent = new Map<string, string>();

  for (const feature of fc.features) {
    const id = feature.id ?? crypto.randomUUID();
    const key = String(id);
    const geometry = feature.geometry;
    const singles = geometry ? singleGeometriesOf(geometry) : [];
    const multiType = geometry ? multiTypeOf(geometry.type) : null;
    const partIds: string[] = [];

    for (const single of singles) {
      const partId = crypto.randomUUID();
      parts.push({
        id: partId,
        type: 'Feature',
        properties: { ...(feature.properties ?? {}), [MODE_PROPERTY]: modeForGeometry(single.type) },
        geometry: single,
      });
      partToParent.set(partId, key);
      partIds.push(partId);
    }

    parents.set(key, {
      id,
      multiType,
      properties: feature.properties ?? {},
      partIds,
      passthroughGeometry: singles.length === 0 ? (geometry ?? null) : null,
    });
  }

  return { parts, index: { parents, partToParent } };
}

function buildGeometry(meta: ParentMeta, ordered: ExplodedFeature[]): Geometry {
  if (meta.multiType === null) return ordered[0].geometry;
  if (meta.multiType === 'MultiPoint') {
    return {
      type: 'MultiPoint',
      coordinates: ordered.map((part) => (part.geometry as Point).coordinates),
    } satisfies MultiPoint;
  }
  if (meta.multiType === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: ordered.map((part) => (part.geometry as LineString).coordinates),
    } satisfies MultiLineString;
  }
  return {
    type: 'MultiPolygon',
    coordinates: ordered.map((part) => (part.geometry as Polygon).coordinates),
  } satisfies MultiPolygon;
}

/** Strip the terra-draw `mode` marker from a freshly-drawn feature's properties. */
function withoutModeMarker(properties: GeoJsonProperties): GeoJsonProperties {
  if (!properties || !(MODE_PROPERTY in properties)) return properties ?? {};
  const rest = { ...properties };
  delete rest[MODE_PROPERTY];
  return rest;
}

/**
 * Rebuild a canonical `FeatureCollection` from the current terra-draw snapshot.
 *
 * - Parts that map back to a known parent are grouped and recombined into the
 *   parent's original Multi (or single) geometry, preserving id, properties and
 *   `featureCount`. Multi* parents stay Multi* even when reduced to one part.
 * - Parts with no parent mapping were drawn fresh in terra-draw → emitted as new
 *   single features (their terra-draw UUID becomes the canonical id).
 * - A parent whose every part has disappeared from the snapshot was deleted.
 * - A non-editable passthrough parent (null / GeometryCollection geometry) is
 *   re-emitted untouched.
 */
export function recombineFromParts(
  parts: ExplodedFeature[],
  index: EditIndex,
): FeatureCollection {
  const grouped = new Map<string, Map<string, ExplodedFeature>>();
  const newFeatures: Feature[] = [];

  for (const part of parts) {
    const partKey = String(part.id);
    const parentKey = index.partToParent.get(partKey);
    if (parentKey === undefined) {
      // Freshly drawn in terra-draw — give it a stable fill key so it can be
      // styled individually just like imported features.
      const properties = withoutModeMarker(part.properties);
      if (properties && !properties[FEATURE_FILL_PROPERTY]) {
        properties[FEATURE_FILL_PROPERTY] = String(part.id);
      }
      newFeatures.push({ type: 'Feature', id: part.id, properties, geometry: part.geometry });
      continue;
    }
    let bucket = grouped.get(parentKey);
    if (!bucket) {
      bucket = new Map();
      grouped.set(parentKey, bucket);
    }
    bucket.set(partKey, part);
  }

  const features: Feature[] = [];
  for (const [key, meta] of index.parents) {
    const present = grouped.get(key);
    if (!present || present.size === 0) {
      // A non-editable geometry (e.g. GeometryCollection) was never exploded into
      // parts ⇒ re-emit it untouched; otherwise the feature was deleted.
      if (meta.partIds.length === 0 && meta.passthroughGeometry) {
        features.push({
          type: 'Feature',
          id: meta.id,
          properties: meta.properties,
          geometry: meta.passthroughGeometry,
        });
      }
      continue;
    }
    const ordered = meta.partIds
      .filter((partId) => present.has(partId))
      .map((partId) => present.get(partId)!);
    features.push({
      type: 'Feature',
      id: meta.id,
      properties: meta.properties,
      geometry: buildGeometry(meta, ordered),
    });
  }

  features.push(...newFeatures);
  return { type: 'FeatureCollection', features };
}
