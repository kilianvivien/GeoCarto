import { test, expect } from '@playwright/test';
import { importGeoJsonFixture, lockMap, expectNoConsoleErrors } from './helpers';

/**
 * CSV attribute join (M31): pick a table, let the app suggest the key pairing,
 * join, and style the layer by a joined numeric column.
 */
test('join a CSV to a layer and undo it', async ({ page }) => {
  const assertNoErrors = await expectNoConsoleErrors(page);
  await page.goto('/');
  await lockMap(page);
  await importGeoJsonFixture(page);

  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByTestId('layer-row').filter({ hasText: 'reference' }).click();
  await page.getByRole('tab', { name: 'Properties' }).click();

  // Semicolon-separated with a decimal comma, as a French spreadsheet exports it.
  await page.getByLabel('Join a CSV…').setInputFiles({
    name: 'figures.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('label;score;note\nReference Area;12,5;big\nReference Point;3;small\nElsewhere;9;unused\n'),
  });

  // The matching key pairing (layer `name` ↔ CSV `label`) is found automatically.
  await expect(page.getByLabel('Layer field')).toHaveValue('name');
  await expect(page.getByLabel('CSV column')).toHaveValue('label');
  await expect(page.getByRole('status').filter({ hasText: 'features match' })).toHaveText('2 of 3 features match');

  await page.getByLabel('note', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByText('Joined 1 column(s) to 2 of 3 features.')).toBeVisible();

  const properties = () =>
    page.evaluate(() => window.__documentStore.getState().project.layers[0].data.features.map((f) => f.properties));
  expect(await properties()).toEqual([
    expect.objectContaining({ name: 'Reference Area', score: 12.5 }),
    expect.not.objectContaining({ score: expect.anything() }),
    expect.objectContaining({ name: 'Reference Point', score: 3 }),
  ]);
  expect((await properties())[0]).not.toHaveProperty('note');

  // The joined number is immediately available to "style by data".
  await page.getByRole('button', { name: 'Color by value' }).click();
  await expect(page.getByLabel('Attribute').first()).toHaveValue('score');

  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  await page.getByRole('button', { name: 'Undo (⌘Z)' }).click();
  expect((await properties())[0]).not.toHaveProperty('score');

  assertNoErrors();
});
