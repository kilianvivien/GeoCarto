import { test, expect } from '@playwright/test';

test('settings locale persists and modal is keyboard closable', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Open settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Language' }).selectOption('fr');
  await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeHidden();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.getByRole('button', { name: 'Ouvrir les réglages' }).click();
  await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();

});

test('command palette filters shared command model', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Command palette' }).click();
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();

  await page.getByPlaceholder('Search commands...').fill('settings');
  await page.getByRole('button', { name: 'Run Open settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});
