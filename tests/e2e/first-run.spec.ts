import { expect, test } from '@playwright/test';

test('first run renders the workspace without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /geocarto workspace/i })).toBeVisible();
  expect(errors).toEqual([]);
});
