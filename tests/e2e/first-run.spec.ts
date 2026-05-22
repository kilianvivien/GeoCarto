import { test, expect } from '@playwright/test';

test('first run: shell, basemap, and navigation', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');

  // App shell chrome is present.
  await expect(page.getByRole('application', { name: /geocarto/i })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: /tools/i })).toBeVisible();

  // The MapLibre basemap canvas renders.
  const mapCanvas = page.locator('.maplibregl-canvas');
  await expect(mapCanvas).toBeVisible();

  // Navigating the map updates the viewport store / status bar.
  const zoomReadout = page.getByTestId('zoom-readout');
  const before = await zoomReadout.textContent();
  await mapCanvas.dblclick();
  await expect(zoomReadout).not.toHaveText(before ?? '');

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
