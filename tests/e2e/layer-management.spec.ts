import { test, expect } from '@playwright/test';
import { lockMap } from './helpers';

/**
 * Layer creation + deletion (Phase 3): create a blank vector layer from scratch,
 * confirm the delete prompt, and undo the deletion with the existing undo path.
 */
test('create a blank layer, delete it with confirmation, and undo', async ({ page }) => {
  // The delete prompt is a native confirm() — accept it.
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/');
  await lockMap(page);
  await page.getByRole('tab', { name: 'Layers' }).click();

  // Create a blank layer; it drops straight into vector edit mode.
  await page.getByRole('button', { name: 'New layer' }).first().click();
  await expect(page.getByRole('toolbar', { name: 'Vector editing tools' })).toBeVisible();
  await page.getByRole('button', { name: /Draw point/ }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.getByTestId('feature-count')).toHaveText('1 feature');
  await page.getByRole('button', { name: 'Done' }).click();

  // Selecting the new layer switches the inspector to Properties; go back to Layers.
  await page.getByRole('tab', { name: 'Layers' }).click();
  const row = page.getByTestId('layer-row').filter({ hasText: 'New layer' });
  await expect(row).toBeVisible();

  // Delete it (the confirm dialog is auto-accepted above).
  await row.getByLabel('Delete layer').click({ force: true });
  await expect(page.getByTestId('layer-row')).toHaveCount(0);

  // Undo restores the deleted layer.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByTestId('layer-row').filter({ hasText: 'New layer' })).toBeVisible();
});
