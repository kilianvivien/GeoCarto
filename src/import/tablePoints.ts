import type { Feature } from 'geojson';
import type { CsvTable } from './csv';

/**
 * How a table's rows are placed on the map: by coordinate columns, or by
 * columns that describe a place in words. Pure and dependency-free — shared by
 * the importer, its worker, and the agent-skill validator.
 */

/**
 * Most rows a single import will geocode. The public Photon service is shared
 * and free; a table this size takes under a minute and stays within fair use.
 */
export const GEOCODE_ROW_LIMIT = 200;

// Header names (lowercased, accents and punctuation removed) that mark coordinate
// columns. Explicit names win over the ambiguous x/y pair.
const LATITUDE_NAMES = [['lat', 'latitude', 'latwgs84', 'latdd'], ['y', 'ycoord', 'coordy']];
const LONGITUDE_NAMES = [['lon', 'lng', 'long', 'longitude', 'lonwgs84', 'lngwgs84', 'londd'], ['x', 'xcoord', 'coordx']];

const headerKey = (column: string) =>
  column
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

function findColumn(columns: string[], names: string[][]): string | undefined {
  for (const group of names) {
    const match = columns.find((column) => group.includes(headerKey(column)));
    if (match) return match;
  }
  return undefined;
}

/** The latitude/longitude columns of a table, when it has both. */
export function coordinateColumns(table: CsvTable): { latitude: string; longitude: string } | null {
  const latitude = findColumn(table.columns, LATITUDE_NAMES);
  const longitude = findColumn(table.columns, LONGITUDE_NAMES);
  return latitude && longitude ? { latitude, longitude } : null;
}

/** A coordinate cell as a number; a quoted decimal comma ("48,85") is still a number. */
function coordinate(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  return value === undefined || value.trim() === '' ? NaN : Number(value.trim().replace(',', '.'));
}

/**
 * One point feature per row with a valid position, keeping every column as a
 * property. `skippedRows` counts the rows left out.
 */
export function pointsFromTable(table: CsvTable): { features: Feature[]; skippedRows: number } {
  const columns = coordinateColumns(table);
  if (!columns) return { features: [], skippedRows: table.rows.length };
  const features: Feature[] = [];
  for (const row of table.rows) {
    const latitude = coordinate(row[columns.latitude]);
    const longitude = coordinate(row[columns.longitude]);
    if (!(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180)) continue;
    features.push({
      type: 'Feature',
      properties: Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value === '' ? null : value])),
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
    });
  }
  return { features, skippedRows: table.rows.length - features.length };
}

// Address parts, in the order they read in a postal address.
const ADDRESS_PARTS = [
  ['address', 'adresse', 'addr', 'street', 'rue', 'voie'],
  ['postcode', 'postalcode', 'zip', 'zipcode', 'codepostal', 'cp'],
  ['city', 'ville', 'commune', 'town', 'municipality', 'localite'],
  ['country', 'pays'],
];
// Used alone when the table has no address parts at all.
const PLACE_NAMES = ['place', 'lieu', 'location', 'localisation', 'name', 'nom'];

/** The columns whose values, joined, describe where a row is. Empty when the table has none. */
export function locationColumns(table: CsvTable): string[] {
  const parts = ADDRESS_PARTS.map((names) => table.columns.find((column) => names.includes(headerKey(column)))).filter(
    (column): column is string => Boolean(column),
  );
  // A country or postcode alone is too vague to be worth a request per row.
  const specific = parts.some((column) => [...ADDRESS_PARTS[0], ...ADDRESS_PARTS[2]].includes(headerKey(column)));
  if (specific) return parts;
  const place = table.columns.find((column) => PLACE_NAMES.includes(headerKey(column)));
  return place ? [place, ...parts] : [];
}

