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

  await page.getByRole('button', { name: 'Minimize map setup' }).click();

  // Navigating the map updates the viewport store / status bar.
  const zoomReadout = page.getByTestId('zoom-readout');
  const before = await zoomReadout.textContent();
  const box = await mapCanvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height - 120);
  await expect(zoomReadout).not.toHaveText(before ?? '');

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
