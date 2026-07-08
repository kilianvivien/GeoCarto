import { test, expect } from '@playwright/test';
import { clickAnnotationStage, disableFileSystemAccess, expectNoConsoleErrors } from './helpers';

async function chooseTool(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).click();
}

test('switch to a projected engine, pick Robinson, add a pin, and export SVG+PNG', async ({ page }) => {
  await disableFileSystemAccess(page);
  const assertNoConsoleErrors = await expectNoConsoleErrors(page);

  await page.goto('/');
  await page.getByTestId('map-setup-expand').click();
  await expect(page.getByText('Set up map')).toBeVisible();

  // Switching engine seeds and fits the default (Equal Earth) projection —
  // pick a *different* one (Robinson) so this also exercises the picker
  // itself, instead of redundantly reselecting the already-active default.
  await page.getByRole('button', { name: /Projected \(editorial\)/ }).click();
  await expect(page.getByText('Projection', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Robinson', exact: true }).click();
  // Picking a projection fits its scale/center asynchronously — wait for that
  // to settle (surfaced via this toast) before touching the numeric inputs,
  // otherwise the async update can clobber an in-flight edit.
  await expect(page.getByText('Projection set to Robinson')).toBeVisible();
  const centerLongitude = page.getByLabel('Center longitude (°)');
  await centerLongitude.fill('-30');
  await expect(centerLongitude).toHaveValue('-30');

  await page.getByRole('button', { name: 'Lock Map Area' }).click();
  await expect(page.getByTestId('projected-map-view')).toBeVisible();

  // Add a map-anchored pin via the tool rail.
  await chooseTool(page, 'Pin');
  await clickAnnotationStage(page, 400, 300);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Pin');
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('annotation-row')).toHaveCount(1);

  // Vector SVG export: projected-engine data layers/land render as real <path>
  // elements, not a raster <image>, per the SVG exporter's projected branch.
  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  let dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'SVG' }).click();
  const [svgDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  const svgStream = await svgDownload.createReadStream();
  expect(svgStream).not.toBeNull();
  const svgChunks: Buffer[] = [];
  for await (const chunk of svgStream!) svgChunks.push(Buffer.from(chunk));
  const svgText = Buffer.concat(svgChunks).toString('utf8');
  expect(svgText).toContain('<svg');
  expect(svgText).toContain('<path');

  // Raster PNG export still works for a projected document.
  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'PNG' }).click();
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  const pngStream = await pngDownload.createReadStream();
  expect(pngStream).not.toBeNull();
  const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(pngChunks).length).toBeGreaterThan(100);

  assertNoConsoleErrors();
});
