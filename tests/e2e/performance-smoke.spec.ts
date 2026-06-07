import { test, expect } from '@playwright/test';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  disableFileSystemAccess,
  fixturePath,
  importGeoJsonFixture,
  lockMap,
  openProjectFixture,
} from './helpers';

/**
 * PRD §7 Phase 1 thresholds. CI is single-core and ~2× slower than a local
 * Mac, so each ceiling carries headroom. Tighten in M17 once the desktop run
 * sheet exists.
 */
const PRD_PHASE1_THRESHOLDS = {
  coldStartMs: process.env.CI ? 4_000 : 2_000,
  importMediumMs: process.env.CI ? 5_000 : 3_000,
  importLargeMs: process.env.CI ? 12_000 : 6_000,
  exportMs: process.env.CI ? 10_000 : 5_000,
  heapMb: 700,
};

function ensureLargeFixture(): string {
  const out = fixturePath('large.geojson');
  if (!existsSync(out) || statSync(out).size < 9 * 1024 * 1024) {
    execFileSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/generate-large-fixture.mjs')],
      { stdio: 'inherit' },
    );
  }
  return out;
}

test('records Phase 1 performance smoke measurements', async ({ page }) => {
  test.setTimeout(120_000);
  await disableFileSystemAccess(page);
  ensureLargeFixture();

  const coldStartAt = Date.now();
  await page.goto('/');
  await expect(page.getByRole('application', { name: /geocarto/i })).toBeVisible();
  const coldStartMs = Date.now() - coldStartAt;

  await lockMap(page);
  const importMediumStart = Date.now();
  await importGeoJsonFixture(page, 'medium.geojson');
  await expect(page.getByTestId('feature-count')).toHaveText('20 features');
  const importMediumMs = Date.now() - importMediumStart;

  const importLargeStart = Date.now();
  await importGeoJsonFixture(page, 'large.geojson');
  // Large fixture has ~36k features — wait until at least one large-count badge appears.
  await expect(page.getByTestId('feature-count').last()).not.toHaveText('20 features', {
    timeout: PRD_PHASE1_THRESHOLDS.importLargeMs + 5_000,
  });
  const importLargeMs = Date.now() - importLargeStart;

  page.once('dialog', (dialog) => dialog.accept());
  await openProjectFixture(page);
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('annotation-row')).toHaveCount(3);

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(dialog).toBeVisible();
  const exportStart = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  let downloadedBytes = 0;
  for await (const chunk of stream!) {
    downloadedBytes += Buffer.from(chunk).length;
  }
  expect(downloadedBytes).toBeGreaterThan(100);
  const exportMs = Date.now() - exportStart;

  const memory = await page.evaluate(() => {
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    };
    return perf.memory ?? null;
  });
  const heapMb =
    memory && typeof memory.usedJSHeapSize === 'number'
      ? memory.usedJSHeapSize / (1024 * 1024)
      : null;

  // Always emit the numbers — useful for trend tracking even when thresholds
  // change. Acceptance assertions follow below.
  console.log(
    JSON.stringify({
      performanceSmoke: {
        coldStartMs,
        importMediumMs,
        importLargeMs,
        exportMs,
        heapMb,
        memory,
        thresholds: PRD_PHASE1_THRESHOLDS,
      },
    }),
  );

  expect(coldStartMs, 'cold start').toBeLessThan(PRD_PHASE1_THRESHOLDS.coldStartMs);
  expect(importMediumMs, 'medium GeoJSON import').toBeLessThan(
    PRD_PHASE1_THRESHOLDS.importMediumMs,
  );
  expect(importLargeMs, '10 MB GeoJSON import').toBeLessThan(
    PRD_PHASE1_THRESHOLDS.importLargeMs,
  );
  expect(exportMs, 'PNG export').toBeLessThan(PRD_PHASE1_THRESHOLDS.exportMs);
  if (heapMb !== null) {
    expect(heapMb, 'JS heap MB').toBeLessThan(PRD_PHASE1_THRESHOLDS.heapMb);
  }
});
