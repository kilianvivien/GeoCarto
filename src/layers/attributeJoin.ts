import type { Feature, FeatureCollection } from 'geojson';
import type { CsvTable } from '@/import/csv';

export interface JoinSpec {
  /** Feature property holding the join key. */
  layerField: string;
  /** Table column holding the join key. */
  tableColumn: string;
  /** Table columns to copy onto matched features. */
  columns: string[];
}

export interface JoinResult {
  data: FeatureCollection;
  /** Features that received values. */
  matched: number;
  /** Table rows whose key matched no feature. */
  unusedRows: number;
}

/**
 * Keys compare as trimmed, case-insensitive text so `75` (number) meets "75"
 * (CSV text). Returns null for empty keys, which never match anything.
 */
function normalizeKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLowerCase();
  return key === '' ? null : key;
}

/** Spreadsheets routinely strip the leading zeros of codes ("01" → 1). */
function looseKey(key: string): string {
  return /^0+\d/.test(key) ? key.replace(/^0+/, '') : key;
}

function indexRows(table: CsvTable, column: string) {
  const exact = new Map<string, number>();
  const loose = new Map<string, number>();
  table.rows.forEach((row, index) => {
    const key = normalizeKey(row[column]);
    if (key === null) return;
    // First row wins on duplicate keys, matching spreadsheet lookup behaviour.
    if (!exact.has(key)) exact.set(key, index);
    const relaxed = looseKey(key);
    if (!loose.has(relaxed)) loose.set(relaxed, index);
  });
  return { exact, loose };
}

function matchRow(feature: Feature, layerField: string, index: ReturnType<typeof indexRows>): number | undefined {
  const key = normalizeKey(feature.properties?.[layerField]);
  if (key === null) return undefined;
  return index.exact.get(key) ?? index.loose.get(looseKey(key));
}

/** How many features a key pairing would match — drives the live preview and key suggestion. */
export function countMatches(features: Feature[], table: CsvTable, layerField: string, tableColumn: string): number {
  const index = indexRows(table, tableColumn);
  return features.reduce((count, feature) => count + (matchRow(feature, layerField, index) === undefined ? 0 : 1), 0);
}

/**
 * Best-matching (layer field, table column) pair, so the common case needs no
 * manual key picking. Scans a sample: enough to rank pairings, cheap on big layers.
 */
export function suggestJoinKeys(
  features: Feature[],
  layerFields: string[],
  table: CsvTable,
): { layerField: string; tableColumn: string } | null {
  const sample = features.slice(0, 500);
  let best: { layerField: string; tableColumn: string; matches: number } | null = null;
  for (const layerField of layerFields) {
    for (const tableColumn of table.columns) {
      const matches = countMatches(sample, table, layerField, tableColumn);
      if (matches > (best?.matches ?? 0)) best = { layerField, tableColumn, matches };
    }
  }
  return best && { layerField: best.layerField, tableColumn: best.tableColumn };
}

/**
 * Copy table columns onto the features whose key matches a row. Unmatched
 * features are left untouched; a joined column overwrites a same-named
 * property, so re-running a join with fresh data updates it in place.
 */
export function joinAttributes(data: FeatureCollection, table: CsvTable, spec: JoinSpec): JoinResult {
  const index = indexRows(table, spec.tableColumn);
  const columns = spec.columns.filter((column) => column !== spec.tableColumn);
  const usedRows = new Set<number>();
  let matched = 0;

  const features = data.features.map((feature) => {
    const rowIndex = matchRow(feature, spec.layerField, index);
    if (rowIndex === undefined) return feature;
    usedRows.add(rowIndex);
    matched += 1;
    const row = table.rows[rowIndex];
    const joined: Record<string, unknown> = { ...feature.properties };
    for (const column of columns) joined[column] = row[column] === '' ? null : row[column];
    return { ...feature, properties: joined };
  });

  // A duplicate of a matched key is shadowed, not unused, so compare by key.
  const usedKeys = new Set([...usedRows].map((rowIndex) => normalizeKey(table.rows[rowIndex][spec.tableColumn])));
  const unusedRows = table.rows.filter((row) => {
    const key = normalizeKey(row[spec.tableColumn]);
    return key !== null && !usedKeys.has(key);
  }).length;
  return { data: { ...data, features }, matched, unusedRows };
}
