import { describe, expect, it } from 'vitest';
import { parseCoordinates } from './parseCoordinates';

describe('parseCoordinates', () => {
  it('parses a comma-separated lat, lon pair as [lng, lat]', () => {
    expect(parseCoordinates('48.85, 2.35')).toEqual({ center: [2.35, 48.85], ambiguous: true });
  });

  it('parses a space-separated pair', () => {
    expect(parseCoordinates('48.85 2.35')).toEqual({ center: [2.35, 48.85], ambiguous: true });
  });

  it('disambiguates when only one lng/lat reading is numerically valid', () => {
    // 132.5 cannot be a latitude, so this can only be [lon, lat].
    expect(parseCoordinates('132.5, 48.85')).toEqual({ center: [132.5, 48.85], ambiguous: false });
  });

  it('disambiguates the reverse case', () => {
    expect(parseCoordinates('48.85, 132.5')).toEqual({ center: [132.5, 48.85], ambiguous: false });
  });

  it('handles negative coordinates', () => {
    expect(parseCoordinates('-33.87, 151.21')).toEqual({ center: [151.21, -33.87], ambiguous: false });
  });

  it('returns null for out-of-range pairs', () => {
    expect(parseCoordinates('200, 300')).toBeNull();
  });

  it('returns null for non-coordinate text', () => {
    expect(parseCoordinates('Paris')).toBeNull();
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('48.85')).toBeNull();
  });

  it('accepts a semicolon separator', () => {
    expect(parseCoordinates('48.85; 2.35')).toEqual({ center: [2.35, 48.85], ambiguous: true });
  });
});
