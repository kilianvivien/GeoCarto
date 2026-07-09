/**
 * Parse a typed `lat, lon` / `lon, lat` pair, bypassing the geocoder entirely.
 * Ambiguous when both numbers fall inside the overlapping ±90 range — in that
 * case we assume `lat, lon` (the far more common convention) and flag it via
 * `ambiguous` so the UI can offer a "swap" hint.
 */
export interface ParsedCoordinates {
  center: [number, number]; // [lng, lat]
  ambiguous: boolean;
}

const PAIR_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/;

export function parseCoordinates(input: string): ParsedCoordinates | null {
  const match = PAIR_PATTERN.exec(input);
  if (!match) return null;

  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const aIsValidLat = a >= -90 && a <= 90;
  const bIsValidLat = b >= -90 && b <= 90;
  const aIsValidLng = a >= -180 && a <= 180;
  const bIsValidLng = b >= -180 && b <= 180;

  // Only one reading (lat, lon) is possible — b can't be a latitude.
  if (aIsValidLat && !bIsValidLat && bIsValidLng) {
    return { center: [b, a], ambiguous: false };
  }
  // Only the reverse reading (lon, lat) is possible.
  if (bIsValidLat && !aIsValidLat && aIsValidLng) {
    return { center: [a, b], ambiguous: false };
  }
  // Both readings are numerically valid — default to `lat, lon` and flag it.
  if (aIsValidLat && bIsValidLng) {
    return { center: [b, a], ambiguous: true };
  }
  return null;
}
