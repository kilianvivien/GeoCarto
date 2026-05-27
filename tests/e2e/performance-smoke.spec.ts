import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, importGeoJsonFixture, lockMap, openProjectFixture } from './helpers';

test('records Phase 1 performance smoke measurements', async ({ page }) => {
  test.setTimeout(60_000);
  await disableFileSystemAccess(page);

  const coldStartAt = Date.now();
  await page.goto('/');
  await expect(page.getByRole('application', { name: /geocarto/i })).toBeVisible();
  const coldStartMs = Date.now() - coldStartAt;

  await lockMap(page);
  const importStart = Date.now();
  await importGeoJsonFixture(page, 'medium.geojson');
  await expect(page.getByTestId('feature-count')).toHaveText('20 features');
  const importMs = Date.now() - importStart;

  page.once('dialog', (dialog) => dialog.accept());
  await openProjectFixture(page);
  await expect(page.getByTestId('annotation-row')).toHaveCount(3);

  await page.getByRole('button', { name: 'Export', exact: true }).click();
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
    // Drain the stream so the browser completes the download work.
  }
  expect(downloadedBytes).toBeGreaterThan(100);
  const exportMs = Date.now() - exportStart;

  const memory = await page.evaluate(() => {
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    };
    return perf.memory ?? null;
  });

  console.log(
    JSON.stringify({
      performanceSmoke: {
        coldStartMs,
        importMs,
        exportMs,
        memory,
      },
    }),
  );

  expect(coldStartMs).toBeGreaterThan(0);
  expect(importMs).toBeGreaterThan(0);
  expect(exportMs).toBeGreaterThan(0);
  expect(coldStartMs).toBeLessThan(2_000);
  expect(importMs).toBeLessThan(3_000);
  expect(exportMs).toBeLessThan(5_000);
});
