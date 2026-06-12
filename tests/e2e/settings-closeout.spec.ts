import { test, expect, type Page } from '@playwright/test';

async function startInEnglish(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('geocarto-locale'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
}

test('settings locale persists and modal is keyboard closable', async ({ page }) => {
  await startInEnglish(page);

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
  await startInEnglish(page);

  await page.getByRole('application', { name: /geocarto/i }).click();
  await page.keyboard.press('ControlOrMeta+K');
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();

  await page.getByPlaceholder('Search commands...').fill('settings');
  await page.getByRole('button', { name: 'Run Open settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});
