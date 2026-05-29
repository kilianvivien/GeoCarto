import type maplibregl from 'maplibre-gl';
import type { MeasurementUnitSystem } from '@/project/cartoproj';

/** Round a value down to the nearest 1 / 2 / 5 × 10ⁿ — the classic scale-bar steps. */
export function niceNumber(value: number): number {
  if (value <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / pow;
  const nice = fraction >= 5 ? 5 : fraction >= 2 ? 2 : 1;
  return nice * pow;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

/**
 * Ground metres represented by one screen pixel at the map's centre. Derived
 * empirically from the live projection so it stays correct for any zoom and
 * latitude without hard-coding the Web Mercator constant.
 */
export function metersPerPixel(map: maplibregl.Map): number {
  const center = map.getCenter();
  const centerPx = map.project(center);
  const offsetPx = map.unproject([centerPx.x + 100, centerPx.y]);
  return haversineMeters([center.lng, center.lat], [offsetPx.lng, offsetPx.lat]) / 100;
}

export interface ScaleBarTick {
  /** On-screen bar length in pixels for the chosen round distance. */
  lengthPx: number;
  /** Human label, e.g. "500 m" or "2 km". */
  label: string;
}

/**
 * Pick a round distance whose bar fits within `maxWidthPx`, returning the bar's
 * exact pixel length and its label. Pure so it can be unit-tested without a map.
 */
export function niceScaleBar(
  metersPerPx: number,
  maxWidthPx: number,
  unitSystem: MeasurementUnitSystem,
): ScaleBarTick {
  if (!Number.isFinite(metersPerPx) || metersPerPx <= 0) {
    return { lengthPx: 0, label: '' };
  }
  if (unitSystem === 'imperial') {
    const feetPerPx = metersPerPx * 3.28084;
    const maxFeet = feetPerPx * maxWidthPx;
    if (maxFeet >= 5280) {
      const milesPerPx = feetPerPx / 5280;
      const miles = niceNumber(milesPerPx * maxWidthPx);
      return { lengthPx: miles / milesPerPx, label: `${formatDistance(miles)} mi` };
    }
    const feet = niceNumber(maxFeet);
    return { lengthPx: feet / feetPerPx, label: `${formatDistance(feet)} ft` };
  }
  const maxMeters = metersPerPx * maxWidthPx;
  if (maxMeters >= 1000) {
    const kmPerPx = metersPerPx / 1000;
    const km = niceNumber(kmPerPx * maxWidthPx);
    return { lengthPx: km / kmPerPx, label: `${formatDistance(km)} km` };
  }
  const meters = niceNumber(maxMeters);
  return { lengthPx: meters / metersPerPx, label: `${formatDistance(meters)} m` };
}

function formatDistance(value: number): string {
  return value >= 1 ? value.toLocaleString('en-US') : String(value);
}

function polygonAreaMeters(points: [number, number][]): number {
  if (points.length < 3) return 0;
  const radius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    sum += toRad(next[0] - current[0]) * (2 + Math.sin(toRad(current[1])) + Math.sin(toRad(next[1])));
  }
  return Math.abs((sum * radius * radius) / 2);
}

/**
 * Distance (and area when ≥3 points) label for a measurement annotation.
 * Shared so the live stage, raster export, and SVG export agree.
 */
export function measurementLabel(
  geoPoints: [number, number][],
  unitSystem: MeasurementUnitSystem,
): string {
  const length = geoPoints.slice(1).reduce((sum, point, index) => {
    return sum + haversineMeters(geoPoints[index], point);
  }, 0);
  const area = polygonAreaMeters(geoPoints);
  if (unitSystem === 'imperial') {
    const feet = length * 3.28084;
    const distance = feet >= 5280 ? `${(feet / 5280).toFixed(2)} mi` : `${Math.round(feet)} ft`;
    return geoPoints.length >= 3 && area > 0
      ? `${distance} · ${((area * 10.7639) / 43560).toFixed(2)} ac`
      : distance;
  }
  const distance = length >= 1000 ? `${(length / 1000).toFixed(2)} km` : `${Math.round(length)} m`;
  return geoPoints.length >= 3 && area > 0
    ? `${distance} · ${(area / 1_000_000).toFixed(2)} km2`
    : distance;
}
