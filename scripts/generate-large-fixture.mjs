#!/usr/bin/env node
// Generates a deterministic ~10 MB GeoJSON fixture used by the Phase 1 exit
// performance smoke (PRD §7). The same seed produces the same file every run,
// so the fixture stays cacheable and diff-stable when refreshed.
//
// Usage: `node scripts/generate-large-fixture.mjs [outPath] [targetMB]`

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SEED = 0xc0ffee;
const targetMB = Number(process.argv[3] ?? 10);
const outPath = resolve(process.argv[2] ?? 'tests/fixtures/large.geojson');

// Mulberry32 — small, deterministic, good enough for fixture jitter.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(SEED);
const round = (n) => Math.round(n * 1e6) / 1e6;

function point() {
  return [round(-180 + rng() * 360), round(-85 + rng() * 170)];
}

function linestring(n = 8) {
  const coords = [];
  let [x, y] = point();
  for (let i = 0; i < n; i += 1) {
    coords.push([round(x), round(y)]);
    x += (rng() - 0.5) * 0.5;
    y += (rng() - 0.5) * 0.5;
  }
  return coords;
}

function polygon() {
  const [cx, cy] = point();
  const ring = [];
  const sides = 5 + Math.floor(rng() * 4);
  const r = 0.05 + rng() * 0.2;
  for (let i = 0; i <= sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2;
    ring.push([round(cx + Math.cos(angle) * r), round(cy + Math.sin(angle) * r)]);
  }
  return [ring];
}

function feature(i) {
  const dice = rng();
  let geometry;
  if (dice < 0.4) geometry = { type: 'Point', coordinates: point() };
  else if (dice < 0.75) geometry = { type: 'LineString', coordinates: linestring() };
  else geometry = { type: 'Polygon', coordinates: polygon() };
  return {
    type: 'Feature',
    properties: {
      id: i,
      name: `Feature ${i}`,
      category: ['city', 'park', 'river', 'road', 'border'][Math.floor(rng() * 5)],
      population: Math.floor(rng() * 1_000_000),
      score: round(rng() * 100),
    },
    geometry,
  };
}

const targetBytes = targetMB * 1024 * 1024;
const features = [];
let bytes = 32; // FeatureCollection envelope baseline
let i = 0;
while (bytes < targetBytes) {
  const f = feature(i);
  features.push(f);
  bytes += JSON.stringify(f).length + 1;
  i += 1;
}

const collection = { type: 'FeatureCollection', features };
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(collection));
process.stdout.write(`Wrote ${features.length} features (${(bytes / 1024 / 1024).toFixed(2)} MB) → ${outPath}\n`);
