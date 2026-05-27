import { test, expect } from '@playwright/test';
import { dropGeoJsonFixture, importGeoJsonFixture, lockMap } from './helpers';

test('import a GeoJSON file via the picker', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);
  await importGeoJsonFixture(page);

  // The layer appears in the panel and the status bar reflects the feature count.
  await expect(page.getByTestId('layer-row')).toContainText('reference');
  await expect(page.getByTestId('feature-count')).toHaveText('3 features');
});

test('import a GeoJSON file via drag and drop', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);
  await dropGeoJsonFixture(page);

  await expect(page.getByTestId('layer-row')).toContainText('reference');
  await expect(page.getByTestId('feature-count')).toHaveText('3 features');
});
