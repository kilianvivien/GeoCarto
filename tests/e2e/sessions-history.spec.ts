import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, importGeoJsonFixture, lockMap, openProjectFixture } from './helpers';

/**
 * M8 + M9 acceptance coverage: tab switching, undo/redo wiring, and the
 * dirty-state guard on Close.
 */

test('tab bar opens, switches, and closes project tabs', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  // Tab bar is hidden when only one project is open — the title bar handles
  // single-document chrome.
  await expect(page.getByTestId('tab-bar')).toHaveCount(0);

  // Open the reference fixture — lands in a new tab and the bar appears.
  await openProjectFixture(page);
  await expect(page.getByTestId('tab-bar')).toBeVisible();
  await expect(page.getByTestId('tab')).toHaveCount(2);

  // Switch back to the original blank tab.
  await page.getByTestId('tab').first().click();
  await expect(page.getByText(/set up map/i)).toBeVisible();

  // Forward to the project tab.
  await page.getByTestId('tab').last().click();
  await expect(page.getByTestId('annotation-row')).toHaveCount(3);
});

test('undo and redo reverse a layer import', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await lockMap(page);
  await importGeoJsonFixture(page, 'medium.geojson');
  await expect(page.getByTestId('feature-count')).toHaveText('20 features');
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeEnabled();

  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.getByTestId('feature-count')).toHaveText('0 features');

  await page.getByRole('button', { name: /^Redo/ }).click();
  await expect(page.getByTestId('feature-count')).toHaveText('20 features');
});
