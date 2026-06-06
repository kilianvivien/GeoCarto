import { test, expect } from '@playwright/test';
import { dropGeoJsonFixture, importGeoJsonFixture, lockMap } from './helpers';

test('import a GeoJSON file via the picker', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);
  await importGeoJsonFixture(page);

  // The layer appears in the panel and the status bar reflects the feature count.
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('layer-row')).toContainText('reference');
  await expect(page.getByTestId('feature-count')).toHaveText('3 features');
});

test('style a GeoJSON layer and lock it against further edits', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);
  await importGeoJsonFixture(page);

  const editToolbar = page.getByRole('toolbar', { name: 'Vector editing tools' });
  if (await editToolbar.isVisible()) {
    await editToolbar.getByRole('button', { name: 'Done' }).click();
  }
  await page.getByRole('tab', { name: 'Properties' }).click();
  await expect(page.getByText('Layer Style')).toBeVisible();
  await page.getByLabel('Layer fill opacity').fill('0.5');
  await page.getByLabel('Layer stroke width').fill('4');

  await page.getByRole('tab', { name: 'Layers' }).click();
  const layerRow = page.getByTestId('layer-row').filter({ hasText: 'reference' });
  await layerRow.getByLabel('Lock layer').click({ force: true });
  await layerRow.click();
  await page.getByRole('tab', { name: 'Properties' }).click();
  await expect(page.getByLabel('Layer fill opacity')).toBeDisabled();
  await expect(page.getByLabel('Layer stroke width')).toBeDisabled();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(layerRow.getByLabel('Delete layer')).toBeDisabled();
});

test('import a GeoJSON file via drag and drop', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);
  await dropGeoJsonFixture(page);

  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('layer-row')).toContainText('reference');
  await expect(page.getByTestId('feature-count')).toHaveText('3 features');
});
