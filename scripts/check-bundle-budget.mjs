#!/usr/bin/env node
// Bundle-budget gate for CI (PHASE2 M7). Reads `dist/` after `vite build` and
// fails when any tracked chunk grows past its budget. The budget is generous
// — the goal is to catch unintended bloat (a dep added without thought), not
// to police every kilobyte.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist/assets');

// Budgets are uncompressed bytes — these match Vite's chunkSizeWarningLimit
// granularity. Bumping a budget should always be a deliberate commit, never
// drive-by.
const BUDGETS = {
  // The initial shell chunk; must stay tight to hit PRD §7 cold start.
  // Raised from 350 KB in 0.4.0: the gate used to measure an arbitrary
  // `index-*` chunk instead of the real entry, which had already grown past it.
  index: 450 * 1024,
  // Renderer chunks fetched after first paint or on demand.
  react: 250 * 1024,
  maplibre: 1_400 * 1024,
  // MapLibre 6 ships its tile worker as a separate file (it used to be inlined
  // in the `maplibre` chunk as a Blob); fetched in parallel with the renderer.
  worker: 600 * 1024,
  konva: 600 * 1024,
  pmtiles: 200 * 1024,
  // Export path — pulled lazily on click. Itself just the wrapper; maplibre
  // is reused from its own chunk.
  raster: 30 * 1024,
  // Feature 3 (editorial projections): d3-geo + d3-geo-projection + topojson-client,
  // lazy — only loaded when a projected-engine document mounts ProjectedMapView or
  // exports. The 110m land TopoJSON itself is a separate `?url`-fetched asset, not
  // part of this JS chunk, so it doesn't count against the JS budget at all.
  projection: 60 * 1024,
  // Embedded verbatim into exported HTML files. This chunk is fetched only
  // when the user chooses HTML export and is excluded from the app-load total.
  // MapLibre 6 needs its module and its worker embedded, hence the larger size.
  htmlRuntime: 1_800 * 1024,
  // CSS — Tailwind + custom tokens.
  css: 200 * 1024,
};

// 3.85 MB total JS/CSS allowance. Raised from 3.7 MB for Feature 3 (editorial
// projections, ~25 KB gzip-able JS in the lazy `naturalEarthOutlines` chunk)
// and Feature 4 (svg2pdf.js, lazy inside the existing PDF export chunk). Both
// additions are lazy-loaded on demand, so the initial `index` shell is unaffected.
//
// 4.8 MB for 0.4.0: MapLibre 6's separate worker (+~495 KB) and deck.gl 9.4,
// whose lazy heatmap chunk now bundles luma.gl's WebGPU backend (+~190 KB).
const TOTAL_BUDGET = 4.8 * 1024 * 1024;

function pickChunk(files, prefix, extension) {
  return files.find((f) => f.startsWith(prefix) && f.endsWith(extension));
}

function pickByPattern(files, pattern, extension) {
  return files.find((f) => pattern.test(f) && f.endsWith(extension));
}

let files;
try {
  files = readdirSync(DIST);
} catch {
  console.error(`Could not read ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

// Several lazy chunks are also named `index-*`, so the shell is identified by
// the entry script that index.html actually loads.
function pickEntryChunk() {
  const html = readFileSync(resolve(DIST, '../index.html'), 'utf8');
  const entry = html.match(/<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/)?.[1];
  return entry && files.includes(entry) ? entry : pickByPattern(files, /^index-/, '.js');
}

const matches = {
  index: pickEntryChunk(),
  react: pickByPattern(files, /^react-/, '.js'),
  maplibre: pickByPattern(files, /^maplibre-(?!gl-worker)/, '.js'),
  worker: pickByPattern(files, /^maplibre-gl-worker-/, '.js'),
  konva: pickByPattern(files, /^konva-/, '.js'),
  pmtiles: pickByPattern(files, /^pmtiles-/, '.js'),
  raster: pickByPattern(files, /^raster-/, '.js'),
  projection: pickByPattern(files, /^naturalEarthOutlines-/, '.js'),
  htmlRuntime: pickByPattern(files, /^html-runtime-/, '.js'),
  css: pickByPattern(files, /^index-/, '.css'),
};

const results = [];
let failed = false;
let total = 0;

for (const [name, file] of Object.entries(matches)) {
  const budget = BUDGETS[name];
  if (!file) {
    results.push({ name, file: '(missing)', size: 0, budget, ok: true });
    continue;
  }
  const size = statSync(resolve(DIST, file)).size;
  if (name !== 'htmlRuntime') total += size;
  const ok = size <= budget;
  if (!ok) failed = true;
  results.push({ name, file, size, budget, ok });
}

// Tally any JS/CSS not covered above (catches accidental new chunks).
for (const file of files) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) continue;
  if (Object.values(matches).includes(file)) continue;
  const size = statSync(resolve(DIST, file)).size;
  total += size;
  results.push({ name: 'other', file, size, budget: null, ok: true });
}

const fmt = (n) => `${(n / 1024).toFixed(1)} KB`;
const pad = (s, n) => s.padEnd(n);

console.log(pad('chunk', 12), pad('file', 36), pad('size', 12), pad('budget', 12), 'ok');
for (const r of results) {
  console.log(
    pad(r.name, 12),
    pad(r.file, 36),
    pad(fmt(r.size), 12),
    pad(r.budget ? fmt(r.budget) : '-', 12),
    r.ok ? '✓' : '✗',
  );
}
console.log(`\nTotal JS+CSS: ${fmt(total)} / budget ${fmt(TOTAL_BUDGET)}`);
if (total > TOTAL_BUDGET) {
  console.error('Total bundle size exceeds the budget.');
  failed = true;
}
if (failed) {
  console.error('\nBundle budget check FAILED. Adjust the budget intentionally or split further.');
  process.exit(1);
}
console.log('Bundle budget OK.');
