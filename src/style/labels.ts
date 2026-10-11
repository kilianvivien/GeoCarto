import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { GeoJsonLayer, LabelStyle } from '@/project/cartoproj';
import { localeNumber } from '@/i18n/useLocale';
import { computeProportionalDomain, resolveCircleRadius } from './dataStyleEvaluate';

export const DEFAULT_LABEL_STYLE: Omit<LabelStyle, 'attribute'> = {
  size: 12,
  color: '#1c1c1e',
  halo: true,
};

export const LABEL_HALO_COLOR = '#ffffff';
/** Font for labels drawn outside MapLibre (projected canvas, SVG/PDF export). */
export const LABEL_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif';
/** Line height as a multiple of the font size. */
export const LABEL_LINE_HEIGHT = 1.2;
/** Halo thickness as a fraction of the font size, shared by every renderer. */
export const LABEL_HALO_RATIO = 0.14;
/** Gap between a point symbol's edge and its label, in pixels. */
const POINT_LABEL_GAP = 3;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? localeNumber(Math.round(value * 100) / 100) : '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

/** The text lines of a feature's label; empty when it has nothing to show. */
export function labelLines(feature: Feature, labels: LabelStyle): string[] {
  const lines = [formatValue(feature.properties?.[labels.attribute])];
  if (labels.valueAttribute) {
    const value = formatValue(feature.properties?.[labels.valueAttribute]);
    lines.push(value && `${value}${labels.valueSuffix ?? ''}`);
  }
  return lines.filter((line) => line !== '');
}

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(area / 2);
}

/** Signed distance from a point to a polygon outline: positive inside, negative outside. */
function distanceToPolygon(x: number, y: number, polygon: Position[][]): number {
  let inside = false;
  let minSquared = Infinity;
  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      let px = ax;
      let py = ay;
      const dx = bx - ax;
      const dy = by - ay;
      if (dx !== 0 || dy !== 0) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
        px = ax + dx * t;
        py = ay + dy * t;
      }
      minSquared = Math.min(minSquared, (x - px) ** 2 + (y - py) ** 2);
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minSquared);
}

/**
 * Pole of inaccessibility — the interior point farthest from the outline — by
 * successive grid refinement (the "polylabel" approach). Unlike a centroid it
 * always lands inside the shape, which matters for crescents and coastlines.
 */
function polygonLabelPoint(polygon: Position[][]): Position | null {
  const outer = polygon[0];
  if (!outer || outer.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];
  const precision = Math.max(width, height) / 100;

  type Cell = { x: number; y: number; half: number; distance: number; potential: number };
  const cell = (x: number, y: number, half: number): Cell => {
    const distance = distanceToPolygon(x, y, polygon);
    return { x, y, half, distance, potential: distance + half * Math.SQRT2 };
  };

  const queue: Cell[] = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) queue.push(cell(x + cellSize / 2, y + cellSize / 2, cellSize / 2));
  }
  let best = cell(minX + width / 2, minY + height / 2, 0);

  while (queue.length > 0) {
    // Cells are few (the search prunes hard), so a linear scan beats maintaining a heap.
    let top = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].potential > queue[top].potential) top = i;
    const [current] = queue.splice(top, 1);
    if (current.distance > best.distance) best = current;
    if (current.potential - best.distance <= precision) continue;
    const half = current.half / 2;
    queue.push(
      cell(current.x - half, current.y - half, half),
      cell(current.x + half, current.y - half, half),
      cell(current.x - half, current.y + half, half),
      cell(current.x + half, current.y + half, half),
    );
  }
  return [best.x, best.y];
}

function lineMidpoint(line: Position[]): Position | null {
  if (line.length === 0) return null;
  let total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  let remaining = total / 2;
  for (let i = 1; i < line.length; i++) {
    const length = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    if (length > 0 && remaining <= length) {
      const t = remaining / length;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    remaining -= length;
  }
  return line[0];
}

function lineLength(line: Position[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return total;
}

const largest = <T,>(items: T[], measure: (item: T) => number): T | undefined =>
  items.reduce<T | undefined>((best, item) => (best === undefined || measure(item) > measure(best) ? item : best), undefined);

/**
 * Where a feature's label sits: the point itself, the middle of a line, or a
 * point well inside a polygon. Multi-part geometries are labeled once, on
 * their largest part (mainland France, not each island).
 */
export function labelAnchor(geometry: Geometry | null | undefined): Position | null {
  if (!geometry) return null;
  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates;
    case 'MultiPoint':
      return geometry.coordinates[0] ?? null;
    case 'LineString':
      return lineMidpoint(geometry.coordinates);
    case 'MultiLineString': {
      const line = largest(geometry.coordinates, lineLength);
      return line ? lineMidpoint(line) : null;
    }
    case 'Polygon':
      return polygonLabelPoint(geometry.coordinates);
    case 'MultiPolygon': {
      const polygon = largest(geometry.coordinates, (rings) => (rings[0] ? ringArea(rings[0]) : 0));
      return polygon ? polygonLabelPoint(polygon) : null;
    }
    case 'GeometryCollection':
      for (const member of geometry.geometries) {
        const anchor = labelAnchor(member);
        if (anchor) return anchor;
      }
      return null;
  }
}

/** One placed label: where it goes, what it says, and how far it sits from a point symbol. */
export interface LayerLabel {
  position: [number, number];
  lines: string[];
  /**
   * Pixels from the anchor to the top of the text. Zero centers the label on
   * the anchor (lines, polygons); point features push it below their symbol.
   */
  offset: number;
}

const cache = new WeakMap<FeatureCollection, { key: string; labels: LayerLabel[] }>();

/**
 * Every label of a layer, in feature order. Shared by the map, the projected
 * canvas, and the vector exporters so they place identical text at identical
 * coordinates. Memoized per feature collection: anchoring polygons is the
 * expensive part and the document only swaps the collection when data changes.
 */
export function layerLabels(layer: GeoJsonLayer): LayerLabel[] {
  const { labels: style, dataStyle, showPoints, pointRadius } = layer.style;
  if (!style || layer.renderStrategy === 'heatmap') return [];
  const key = JSON.stringify([style.attribute, style.valueAttribute, style.valueSuffix, dataStyle, showPoints, pointRadius]);
  const cached = cache.get(layer.data);
  if (cached?.key === key) return cached.labels;

  const domain = computeProportionalDomain(layer);
  const labels: LayerLabel[] = [];
  for (const feature of layer.data.features) {
    const lines = labelLines(feature, style);
    if (lines.length === 0) continue;
    const anchor = labelAnchor(feature.geometry);
    if (!anchor || !Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) continue;
    const isPoint = feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint';
    const radius = isPoint && showPoints ? resolveCircleRadius(feature, layer, domain) : 0;
    labels.push({
      position: [anchor[0], anchor[1]],
      lines,
      offset: isPoint && radius > 0 ? radius + POINT_LABEL_GAP : 0,
    });
  }
  cache.set(layer.data, { key, labels });
  return labels;
}
