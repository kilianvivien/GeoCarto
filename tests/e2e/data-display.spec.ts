import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, expectNoConsoleErrors, importGeoJsonFixture, lockMap } from './helpers';

/**
 * Structured-data display: a CSV with coordinates becomes a point layer, gets
 * colored by a text attribute, labeled from another, and all of it survives
 * into the vector export.
 */
test('import CSV points, color them by category, label them, and export', async ({ page }) => {
  const assertNoErrors = await expectNoConsoleErrors(page);
  await disableFileSystemAccess(page);
  await page.goto('/');
  await lockMap(page);

  // Semicolon-separated with decimal commas; one row has no coordinates.
  await importGeoJsonFixture(page, 'sites.csv');
  await expect(page.getByText('Imported "sites" — 5 features')).toBeVisible();
  await expect(page.getByText('1 row(s) of sites.csv had no usable location and were left out.')).toBeVisible();

  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByTestId('layer-row').filter({ hasText: 'sites' }).click();
  await page.getByRole('tab', { name: 'Properties' }).click();

  // Categories: the text attribute with the fewest distinct values is picked.
  await page.getByRole('button', { name: 'Color by category' }).click();
  await expect(page.getByLabel('Attribute').first()).toHaveValue('type');
  await expect(page.getByLabel('Color for museum')).toBeVisible();
  await expect(page.getByLabel('Color for palace')).toBeVisible();
  await expect(page.getByLabel('Color for monument')).toBeVisible();
  await page.getByLabel('Color for palace').fill('#112233');

  // A linked legend lists one entry per category.
  await page.getByRole('button', { name: 'Create legend from style' }).click();
  const legendLabels = () =>
    page.evaluate(() => {
      const legend = window.__documentStore.getState().project.annotations.find((a) => a.kind === 'legend');
      return legend?.kind === 'legend' ? legend.entries.map((entry) => `${entry.label}:${entry.swatchColor}`) : [];
    });
  expect(await legendLabels()).toEqual(['museum:#66c2a5', 'palace:#112233', 'monument:#8da0cb']);

  // Creating the legend selected it; go back to the layer for its label settings.
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByTestId('layer-row').filter({ hasText: 'sites' }).click();
  await page.getByRole('tab', { name: 'Properties' }).click();

  // Labels default to the name-like attribute; add the value as a second line.
  await page.getByLabel('Show labels').check();
  await expect(page.getByRole('combobox', { name: 'Text', exact: true })).toHaveValue('name');
  await page.getByLabel('Second line').selectOption('visitors');

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'SVG' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export', exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(chunks).toString('utf8');

  // Points carry their category color, and every label is exported as text.
  // (Matched as point paths: the legend swatches reuse the same colors.)
  expect(svg.match(/<path d="[^"]*" fill="#112233" stroke="#ffffff"/g)).toHaveLength(2);
  expect(svg.match(/<path d="[^"]*" fill="#66c2a5" stroke="#ffffff"/g)).toHaveLength(2);
  expect(svg).toContain('<g id="data-labels"><g id="labels-1-sites">');
  for (const name of ['Louvre', 'Orsay', 'Versailles', 'Chambord', 'Pont du Gard']) {
    expect(svg).toContain(`>${name}</tspan>`);
  }
  expect(svg).toContain('>8,900,000</tspan>');

  assertNoErrors();
});
