import { COLOR_RAMPS } from '@/style/ramps';

/**
 * Structural check of a `.cartoproj` document as people and AI agents may
 * *author* it: only `version` is required, everything else is optional and
 * completed by `normalizeProject` on open. What is present must be well-formed.
 *
 * Severity is what separates the two audiences. An **error** is structural:
 * the app cannot make sense of the value and refuses the file. A **warning**
 * is something that opens but will not look right — a style naming an
 * attribute no feature has, coordinates that are not degrees. The app must
 * keep opening such files (people have saved them); the skill's validator
 * treats warnings as failures so an agent fixes them before handing over.
 *
 * Pure and dependency-free on purpose — the same code runs when the app opens
 * a file and inside the agent skill's standalone `validate.mjs`. Messages are
 * plain English with a JSON path, written to be acted on by whoever (or
 * whatever) produced the file.
 */
export interface ProjectIssue {
  severity: 'error' | 'warning';
  /** Where in the document, e.g. `layers[0].style.dataStyle.attribute`. */
  path: string;
  message: string;
}

export const ANNOTATION_KINDS = [
  'text', 'rectangle', 'ellipse', 'line', 'arrow', 'polygon', 'pin', 'measurement', 'image', 'legend',
  'comment', 'titleblock', 'sourcecredit', 'scalebar', 'northarrow', 'graticule',
] as const;
export const BASEMAP_KINDS = ['builtin', 'style-url', 'style-json', 'pmtiles-url', 'pmtiles-file', 'static', 'empty'] as const;
export const BASEMAP_PRESETS = ['editorial-light', 'editorial-dark', 'minimal-grey', 'print-bw'] as const;
export const PROJECTION_IDS = ['equal-earth', 'robinson', 'winkel3', 'bonne', 'natural-earth-1'] as const;
export const CLASSIFICATION_METHODS = ['quantile', 'equal', 'jenks', 'manual'] as const;
const GEOMETRY_TYPES = ['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection'];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isLngLat = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length >= 2 && isNumber(value[0]) && isNumber(value[1]) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
const oneOf = (values: readonly string[]) => values.map((value) => `"${value}"`).join(', ');

/** First coordinate pair of a geometry's (arbitrarily nested) coordinates. */
function firstPosition(coordinates: unknown): unknown {
  let current = coordinates;
  while (Array.isArray(current) && Array.isArray(current[0])) current = current[0];
  return current;
}

/** `parent.key`, or just `key` at the document root. */
const at = (path: string, key: string) => (path ? `${path}.${key}` : key);

class Checker {
  readonly issues: ProjectIssue[] = [];
  error(path: string, message: string) {
    this.issues.push({ severity: 'error', path, message });
  }
  warn(path: string, message: string) {
    this.issues.push({ severity: 'warning', path, message });
  }
  /** Report a present-but-wrong value; absent values are fine (they get defaults). */
  optional(value: unknown, ok: boolean, path: string, expected: string): boolean {
    if (value === undefined) return false;
    if (!ok) this.error(path, `must be ${expected}`);
    return ok;
  }
  string(parent: Json, key: string, path: string) {
    return this.optional(parent[key], typeof parent[key] === 'string', at(path, key), 'a string');
  }
  number(parent: Json, key: string, path: string, min = -Infinity, max = Infinity) {
    const value = parent[key];
    const range = min === -Infinity && max === Infinity ? 'a number' : `a number between ${min} and ${max}`;
    return this.optional(value, isNumber(value) && value >= min && value <= max, at(path, key), range);
  }
  boolean(parent: Json, key: string, path: string) {
    return this.optional(parent[key], typeof parent[key] === 'boolean', at(path, key), 'true or false');
  }
  enum(parent: Json, key: string, path: string, values: readonly string[]) {
    const value = parent[key];
    return this.optional(value, typeof value === 'string' && values.includes(value), at(path, key), `one of ${oneOf(values)}`);
  }
  /** Any CSS color string — what the app's own color pickers may have saved. */
  color(parent: Json, key: string, path: string) {
    const value = parent[key];
    return this.optional(value, typeof value === 'string' && value.trim() !== '', at(path, key), 'a color such as "#1f77b4"');
  }
  /** Strictly `#rrggbb`: these colors are edited through native color inputs. */
  hexColor(parent: Json, key: string, path: string) {
    const value = parent[key];
    return this.optional(value, typeof value === 'string' && HEX_COLOR.test(value), at(path, key), 'a 6-digit hex color like "#1f77b4"');
  }
}

/**
 * Check a GeoJSON FeatureCollection as GeoCarto will use it. Returns the set
 * of attribute names found (for cross-checking styles) and whether any value
 * of each is numeric.
 */
export function checkFeatureCollection(data: unknown, path: string, check = new Checker()): { issues: ProjectIssue[]; attributes: Map<string, { numeric: boolean; distinct: Set<string> }> } {
  const attributes = new Map<string, { numeric: boolean; distinct: Set<string> }>();
  const result = { issues: check.issues, attributes };
  if (!isObject(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    check.error(path, 'must be a GeoJSON FeatureCollection: { "type": "FeatureCollection", "features": [...] }');
    return result;
  }
  if (data.features.length === 0) check.warn(`${path}.features`, 'is empty: the layer will show nothing');
  if ('crs' in data) check.warn(`${path}.crs`, 'is ignored: coordinates are always read as WGS84 longitude/latitude');

  let reported = 0;
  data.features.forEach((feature: unknown, index: number) => {
    const at = `${path}.features[${index}]`;
    // A broken file repeats the same mistake on every feature; a handful of examples is enough.
    const report = (suffix: string, message: string, severity: 'error' | 'warning' = 'error') => {
      if (reported++ < 5) check.issues.push({ severity, path: `${at}${suffix}`, message });
    };
    if (!isObject(feature) || feature.type !== 'Feature') return report('', 'must be a GeoJSON Feature');
    const geometry = feature.geometry;
    if (geometry !== null) {
      if (!isObject(geometry) || !GEOMETRY_TYPES.includes(geometry.type as string)) {
        report('.geometry', `must be null or a geometry of type ${GEOMETRY_TYPES.join(', ')}`);
      } else if (geometry.type !== 'GeometryCollection') {
        const position = firstPosition(geometry.coordinates);
        if (!Array.isArray(position) || !isNumber(position[0]) || !isNumber(position[1])) {
          report('.geometry.coordinates', 'must hold [longitude, latitude] number pairs');
        } else if (!isLngLat(position)) {
          report('.geometry.coordinates', `[${position[0]}, ${position[1]}] is not a longitude/latitude: coordinates must be WGS84 degrees in [longitude, latitude] order, not projected meters`, 'warning');
        }
      }
    }
    if (feature.properties !== null && feature.properties !== undefined && !isObject(feature.properties)) {
      return report('.properties', 'must be an object or null');
    }
    for (const [key, value] of Object.entries((feature.properties as Json | null) ?? {})) {
      let entry = attributes.get(key);
      if (!entry) attributes.set(key, (entry = { numeric: false, distinct: new Set() }));
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))) entry.numeric = true;
      if (entry.distinct.size < 200) entry.distinct.add(String(value));
      if (typeof value === 'object' && reported++ < 5) {
        check.warn(`${at}.properties.${key}`, 'is a nested object or array; GeoCarto reads flat properties (text, numbers, booleans)');
      }
    }
  });
  if (reported > 5) check.warn(`${path}.features`, `${reported - 5} more feature problem(s) not listed`);
  return result;
}

function checkLayer(check: Checker, layer: unknown, path: string, layerIds: Set<string>): void {
  if (!isObject(layer)) return check.error(path, 'must be an object');
  if (check.string(layer, 'id', path)) {
    if (layerIds.has(layer.id as string)) check.error(`${path}.id`, `"${layer.id}" is used by another layer; ids must be unique`);
    layerIds.add(layer.id as string);
  }
  check.string(layer, 'name', path);
  check.boolean(layer, 'visible', path);
  check.boolean(layer, 'locked', path);
  check.enum(layer, 'renderStrategy', path, ['vector', 'heatmap']);
  if (layer.kind !== undefined && layer.kind !== 'geojson') check.error(`${path}.kind`, 'must be "geojson"');
  if (layer.data === undefined) return check.error(`${path}.data`, 'is required: the layer\'s GeoJSON FeatureCollection, inline');
  const { attributes } = checkFeatureCollection(layer.data, `${path}.data`, check);

  const style = layer.style;
  if (style === undefined) return;
  if (!isObject(style)) return check.error(`${path}.style`, 'must be an object');
  const stylePath = `${path}.style`;
  for (const key of ['fillColor', 'strokeColor', 'pointColor', 'hatchColor']) check.color(style, key, stylePath);
  check.number(style, 'fillOpacity', stylePath, 0, 1);
  check.number(style, 'strokeWidth', stylePath, 0);
  check.number(style, 'pointRadius', stylePath, 0);
  check.boolean(style, 'showPoints', stylePath);
  check.enum(style, 'fillPattern', stylePath, ['none', 'diagonal', 'crosshatch', 'horizontal', 'vertical', 'dots']);

  const attribute = (owner: Json, key: string, ownerPath: string, needsNumbers: boolean): void => {
    const name = owner[key];
    if (typeof name !== 'string' || name === '') return check.error(`${ownerPath}.${key}`, 'is required: the name of a feature property');
    const found = attributes.get(name);
    if (!found) {
      const known = [...attributes.keys()].filter((k) => !k.startsWith('@')).slice(0, 12);
      return check.warn(`${ownerPath}.${key}`, `"${name}" is not a property of this layer's features (found: ${known.join(', ') || 'none'})`);
    }
    if (needsNumbers && !found.numeric) check.warn(`${ownerPath}.${key}`, `"${name}" has no numeric values; this style needs numbers`);
  };

  const dataStyle = style.dataStyle;
  if (dataStyle !== undefined) {
    const dsPath = `${stylePath}.dataStyle`;
    if (!isObject(dataStyle)) check.error(dsPath, 'must be an object');
    else if (dataStyle.kind === 'choropleth') {
      attribute(dataStyle, 'attribute', dsPath, true);
      check.enum(dataStyle, 'method', dsPath, CLASSIFICATION_METHODS);
      check.number(dataStyle, 'classCount', dsPath, 3, 9);
      check.boolean(dataStyle, 'reverse', dsPath);
      check.color(dataStyle, 'missingColor', dsPath);
      check.enum(dataStyle, 'paletteId', dsPath, COLOR_RAMPS.map((ramp) => ramp.id));
      const breaks = dataStyle.breaks;
      const ascending = Array.isArray(breaks) && breaks.every((b, i) => isNumber(b) && (i === 0 || b > (breaks[i - 1] as number)));
      check.optional(breaks, ascending, `${dsPath}.breaks`, 'an ascending list of numbers');
      if (dataStyle.method === 'manual' && breaks === undefined) check.error(`${dsPath}.breaks`, 'is required when method is "manual"');
    } else if (dataStyle.kind === 'proportional') {
      attribute(dataStyle, 'attribute', dsPath, true);
      check.number(dataStyle, 'minRadius', dsPath, 1, 60);
      check.number(dataStyle, 'maxRadius', dsPath, 1, 120);
      check.enum(dataStyle, 'scale', dsPath, ['sqrt', 'linear']);
      check.color(dataStyle, 'color', dsPath);
    } else if (dataStyle.kind === 'categorical') {
      attribute(dataStyle, 'attribute', dsPath, false);
      check.color(dataStyle, 'otherColor', dsPath);
      const categories = dataStyle.categories;
      if (check.optional(categories, Array.isArray(categories), `${dsPath}.categories`, 'a list of { "value", "color" } pairs')) {
        const seen = new Set<string>();
        (categories as unknown[]).forEach((category, index) => {
          const cPath = `${dsPath}.categories[${index}]`;
          if (!isObject(category) || typeof category.value !== 'string') return check.error(cPath, 'must be { "value": "<text>", "color": "#rrggbb" } — values are matched as text');
          check.hexColor(category, 'color', cPath);
          if (category.color === undefined) check.error(`${cPath}.color`, 'is required');
          if (seen.has(category.value)) check.error(`${cPath}.value`, `"${category.value}" is listed twice`);
          seen.add(category.value);
          const known = typeof dataStyle.attribute === 'string' ? attributes.get(dataStyle.attribute) : undefined;
          if (known && known.distinct.size < 200 && !known.distinct.has(category.value)) {
            check.warn(`${cPath}.value`, `no feature has ${dataStyle.attribute} = "${category.value}"; the match is exact and case-sensitive`);
          }
        });
        if ((categories as unknown[]).length > 12) check.warn(`${dsPath}.categories`, 'has more than 12 entries; a map this varied is hard to read');
      }
    } else {
      check.error(`${dsPath}.kind`, 'must be one of "choropleth", "proportional", "categorical"');
    }
  }

  const labels = style.labels;
  if (labels !== undefined) {
    const lPath = `${stylePath}.labels`;
    if (!isObject(labels)) return check.error(lPath, 'must be an object');
    attribute(labels, 'attribute', lPath, false);
    if (labels.valueAttribute !== undefined) attribute(labels, 'valueAttribute', lPath, false);
    check.string(labels, 'valueSuffix', lPath);
    check.number(labels, 'size', lPath, 6, 48);
    check.color(labels, 'color', lPath);
    check.boolean(labels, 'halo', lPath);
  }
}

function checkAnnotation(check: Checker, annotation: unknown, path: string, ids: Set<string>, layerIds: Set<string>): void {
  if (!isObject(annotation)) return check.error(path, 'must be an object');
  if (typeof annotation.kind !== 'string' || !(ANNOTATION_KINDS as readonly string[]).includes(annotation.kind)) {
    return check.error(`${path}.kind`, `is required and must be one of ${oneOf(ANNOTATION_KINDS)}`);
  }
  if (check.string(annotation, 'id', path)) {
    if (ids.has(annotation.id as string)) check.error(`${path}.id`, `"${annotation.id}" is used by another annotation; ids must be unique`);
    ids.add(annotation.id as string);
  }
  check.string(annotation, 'name', path);
  check.boolean(annotation, 'visible', path);
  check.boolean(annotation, 'locked', path);
  check.number(annotation, 'rotation', path);
  check.number(annotation, 'opacity', path, 0, 1);
  check.enum(annotation, 'anchorMode', path, ['map', 'canvas']);
  const position = annotation.position;
  check.optional(position, isObject(position) && isNumber(position.x) && isNumber(position.y), `${path}.position`, '{ "x": number, "y": number } in canvas pixels');
  const geoAnchor = annotation.geoAnchor;
  check.optional(geoAnchor, geoAnchor === null || isLngLat(geoAnchor), `${path}.geoAnchor`, 'null or [longitude, latitude]');
  if (annotation.anchorMode === 'map' && !isLngLat(geoAnchor)) {
    check.error(`${path}.geoAnchor`, 'is required when anchorMode is "map": [longitude, latitude]');
  }
  if (annotation.style !== undefined && !isObject(annotation.style)) check.error(`${path}.style`, 'must be an object');

  for (const key of ['text', 'title', 'subtitle', 'label']) check.string(annotation, key, path);
  for (const key of ['width', 'height', 'size', 'maxWidth', 'radiusX', 'radiusY']) check.number(annotation, key, path, 0);
  if (annotation.kind === 'legend') {
    const link = annotation.dataStyleLink;
    if (link !== undefined) {
      if (!isObject(link) || typeof link.layerId !== 'string') check.error(`${path}.dataStyleLink`, 'must be { "layerId": "<id of a layer>" }');
      else if (!layerIds.has(link.layerId)) check.error(`${path}.dataStyleLink.layerId`, `"${link.layerId}" is not the id of a layer in this project`);
    } else if (annotation.entries === undefined) {
      check.error(path, 'a legend needs either "dataStyleLink" (entries generated from a layer\'s data style) or "entries"');
    }
    if (annotation.entries !== undefined && !Array.isArray(annotation.entries)) check.error(`${path}.entries`, 'must be a list');
  }
  if ((annotation.kind === 'line' || annotation.kind === 'arrow' || annotation.kind === 'polygon') && annotation.points !== undefined) {
    const points = annotation.points;
    const ok = Array.isArray(points) && points.length >= 4 && points.length % 2 === 0 && points.every(isNumber);
    if (!ok) check.error(`${path}.points`, 'must be a flat list of numbers [x1, y1, x2, y2, ...] relative to position');
  }
}

/** Check an authored project document. An empty `errors` list means GeoCarto will open it. */
export function checkProject(value: unknown): ProjectIssue[] {
  const check = new Checker();
  if (!isObject(value)) {
    check.error('', 'the file must contain a JSON object');
    return check.issues;
  }
  if (value.version !== 1) check.error('version', 'is required and must be the number 1');
  check.enum(value, 'mode', '', ['mapSetup', 'editing']);
  check.enum(value, 'engine', '', ['mercator', 'projected']);

  if (check.optional(value.meta, isObject(value.meta), 'meta', 'an object')) check.string(value.meta as Json, 'name', 'meta');

  const viewport = value.viewport;
  if (check.optional(viewport, isObject(viewport), 'viewport', 'an object')) {
    const v = viewport as Json;
    check.optional(v.center, isLngLat(v.center), 'viewport.center', '[longitude, latitude]');
    check.number(v, 'zoom', 'viewport', 0, 24);
    check.number(v, 'bearing', 'viewport');
    check.number(v, 'pitch', 'viewport', 0, 85);
    const b = v.bounds;
    const okBounds = Array.isArray(b) && b.length === 4 && isLngLat([b[0], b[1]]) && isLngLat([b[2], b[3]]) && b[0] < b[2] && b[1] < b[3];
    check.optional(b, okBounds, 'viewport.bounds', '[west, south, east, north] in degrees, with west < east and south < north');
  }

  const frame = value.exportFrame;
  if (check.optional(frame, isObject(frame), 'exportFrame', 'an object')) {
    check.number(frame as Json, 'width', 'exportFrame', 1, 100000);
    check.number(frame as Json, 'height', 'exportFrame', 1, 100000);
    check.number(frame as Json, 'dpiScale', 'exportFrame', 0.01, 100);
  }

  const basemap = value.basemap;
  if (check.optional(basemap, isObject(basemap), 'basemap', 'an object')) {
    const b = basemap as Json;
    if (b.kind === undefined) check.error('basemap.kind', `is required: one of ${oneOf(BASEMAP_KINDS)}`);
    else check.enum(b, 'kind', 'basemap', BASEMAP_KINDS);
    check.enum(b, 'preset', 'basemap', BASEMAP_PRESETS);
    if ((b.kind === 'style-url' || b.kind === 'pmtiles-url') && typeof b.url !== 'string') check.error('basemap.url', 'is required for this basemap kind');
  }
  if (value.engine === 'projected' && isObject(value.projection)) {
    const id = value.projection.id;
    // The app falls back to Equal Earth, so this never blocks opening.
    if (id !== undefined && !(PROJECTION_IDS as readonly unknown[]).includes(id)) {
      check.warn('projection.id', `must be one of ${oneOf(PROJECTION_IDS)}`);
    }
  }

  const layerIds = new Set<string>();
  if (check.optional(value.layers, Array.isArray(value.layers), 'layers', 'a list')) {
    (value.layers as unknown[]).forEach((layer, index) => checkLayer(check, layer, `layers[${index}]`, layerIds));
  }
  const annotationIds = new Set<string>();
  if (check.optional(value.annotations, Array.isArray(value.annotations), 'annotations', 'a list')) {
    (value.annotations as unknown[]).forEach((annotation, index) =>
      checkAnnotation(check, annotation, `annotations[${index}]`, annotationIds, layerIds),
    );
  }
  return check.issues;
}

/** One line per issue, e.g. `error  layers[0].data: must be …`. */
export function formatIssues(issues: ProjectIssue[]): string {
  return issues.map((issue) => `${issue.severity.padEnd(7)} ${issue.path || '(document)'}: ${issue.message}`).join('\n');
}
