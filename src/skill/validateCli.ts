/**
 * Source of the agent skill's `scripts/validate.mjs` (bundled by
 * `scripts/build-skill.mjs`). It reuses the app's own schema checker, CSV
 * parser, and column detection, so "the validator passes" and "GeoCarto opens
 * it as intended" cannot drift apart.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parseCsv } from '@/import/csv';
import { GEOCODE_ROW_LIMIT, coordinateColumns, locationColumns, pointsFromTable } from '@/import/tablePoints';
import { checkFeatureCollection, checkProject, formatIssues, type ProjectIssue } from '@/project/schema';

interface Report {
  issues: ProjectIssue[];
  /** Facts about the file that help decide how to style it. */
  notes: string[];
}

const error = (path: string, message: string): ProjectIssue => ({ severity: 'error', path, message });
const warning = (path: string, message: string): ProjectIssue => ({ severity: 'warning', path, message });

function describeAttributes(attributes: Map<string, { numeric: boolean; distinct: Set<string> }>): string[] {
  const visible = [...attributes.entries()].filter(([name]) => !name.startsWith('@'));
  const numeric = visible.filter(([, info]) => info.numeric).map(([name]) => name);
  const categorical = visible
    .filter(([, info]) => !info.numeric && info.distinct.size >= 2 && info.distinct.size <= 12)
    .map(([name, info]) => `${name} (${info.distinct.size} values)`);
  return [
    `numeric attributes (choropleth / proportional): ${numeric.join(', ') || 'none'}`,
    `category attributes (2-12 distinct values): ${categorical.join(', ') || 'none'}`,
  ];
}

function parseJson(text: string): { value?: unknown; issue?: ProjectIssue } {
  try {
    return { value: JSON.parse(text) };
  } catch (cause) {
    return { issue: error('', `is not valid JSON: ${(cause as Error).message}`) };
  }
}

function validateProjectFile(text: string): Report {
  const { value, issue } = parseJson(text);
  if (issue) return { issues: [issue], notes: [] };
  const issues = checkProject(value);
  const layers = Array.isArray((value as { layers?: unknown[] }).layers) ? (value as { layers: unknown[] }).layers : [];
  const annotations = (value as { annotations?: unknown[] }).annotations;
  const viewport = (value as { viewport?: { bounds?: unknown; center?: unknown } }).viewport;
  if (layers.length > 0 && !viewport?.bounds && !viewport?.center) {
    issues.push(warning('viewport', 'has neither "bounds" nor "center": the map will open on the default view, not on the data'));
  }
  return { issues, notes: [`${layers.length} layer(s), ${Array.isArray(annotations) ? annotations.length : 0} annotation(s)`] };
}

function validateGeoJsonFile(text: string): Report {
  const { value, issue } = parseJson(text);
  if (issue) return { issues: [issue], notes: [] };
  const { issues, attributes } = checkFeatureCollection(value, '');
  const count = Array.isArray((value as { features?: unknown[] }).features) ? (value as { features: unknown[] }).features.length : 0;
  return { issues, notes: [`${count} feature(s)`, ...describeAttributes(attributes)] };
}

function validateTableFile(text: string): Report {
  let table;
  try {
    table = parseCsv(text);
  } catch {
    return { issues: [error('', 'needs a header row and at least one data row')], notes: [] };
  }
  const notes = [`${table.rows.length} row(s), columns: ${table.columns.join(', ')}`];
  const issues: ProjectIssue[] = [];
  const coordinates = coordinateColumns(table);
  if (coordinates) {
    const { features, skippedRows } = pointsFromTable(table);
    notes.push(`imports as a point layer using "${coordinates.latitude}" / "${coordinates.longitude}": ${features.length} point(s)`);
    if (features.length === 0) issues.push(error('', 'no row holds a valid latitude (-90..90) and longitude (-180..180)'));
    else if (skippedRows > 0) issues.push(warning('', `${skippedRows} row(s) have no valid coordinates and will be left out`));
    return { issues, notes };
  }
  const location = locationColumns(table);
  if (location.length > 0) {
    notes.push(`no coordinate columns: rows will be geocoded from ${location.join(' + ')} (slower, approximate, needs network)`);
    if (table.rows.length > GEOCODE_ROW_LIMIT) {
      issues.push(error('', `${table.rows.length} rows exceed the ${GEOCODE_ROW_LIMIT}-row geocoding limit: add latitude/longitude columns`));
    } else {
      issues.push(warning('', 'prefer adding "lat" and "lon" columns: geocoding is approximate and can miss rows'));
    }
    return { issues, notes };
  }
  notes.push('no location columns: cannot be imported as a layer, only attached to one with "Join data" (via a shared key column)');
  return { issues, notes };
}

const VALIDATORS: Record<string, (text: string) => Report> = {
  '.cartoproj': validateProjectFile,
  '.geojson': validateGeoJsonFile,
  '.json': validateGeoJsonFile,
  '.csv': validateTableFile,
  '.tsv': validateTableFile,
};

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: node validate.mjs <file.cartoproj | file.geojson | file.csv> [...]');
  console.log('Exits 0 only when every file is clean. Warnings count: fix them too.');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const validate = VALIDATORS[extname(file).toLowerCase()];
  let report: Report;
  if (!validate) {
    report = { issues: [error('', 'unsupported extension: use .cartoproj, .geojson, .csv, or .tsv')], notes: [] };
  } else {
    try {
      report = validate(readFileSync(file, 'utf8'));
    } catch (cause) {
      report = { issues: [error('', `cannot be read: ${(cause as Error).message}`)], notes: [] };
    }
  }
  const clean = report.issues.length === 0;
  failed ||= !clean;
  console.log(`${clean ? 'OK  ' : 'FAIL'} ${file}`);
  for (const note of report.notes) console.log(`     ${note}`);
  if (!clean) console.log(formatIssues(report.issues).replace(/^/gm, '     '));
}
process.exit(failed ? 1 : 0);
