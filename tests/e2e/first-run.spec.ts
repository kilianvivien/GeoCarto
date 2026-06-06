import { test, expect } from '@playwright/test';
import { expectNoConsoleErrors } from './helpers';

test('first run: shell, basemap, and navigation', async ({ page }) => {
  const assertNoConsoleErrors = await expectNoConsoleErrors(page);

  await page.goto('/');

  // App shell chrome is present.
  await expect(page.getByRole('application', { name: /geocarto/i })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: /tools/i })).toBeVisible();
  await expect(page.getByText('Set up map')).toBeVisible();

  // The MapLibre basemap canvas renders.
  const mapCanvas = page.locator('.maplibregl-canvas');
  await expect(mapCanvas).toBeVisible();

  await page.getByTestId('map-setup-minimize').click({ force: true });

  // Navigating the map updates the viewport store / status bar.
  const zoomReadout = page.getByTestId('zoom-readout');
  const before = await zoomReadout.textContent();
  const box = await mapCanvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height - 120);
  await expect(zoomReadout).not.toHaveText(before ?? '');

  await page.getByRole('button', { name: 'Lock Map Area' }).click();
  await expect(page.getByRole('button', { name: /Unlock Map/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rectangle/ })).toBeEnabled();

  assertNoConsoleErrors();
});
