import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, openProjectFixture } from './helpers';

test('export a PNG from the locked composition frame', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);

  await page.getByRole('button', { name: 'Export' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('export-output-size')).toHaveText('1600 × 1200 px');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);

  expect(download.suggestedFilename()).toBe('Reference Project.png');
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  expect(buffer.length).toBeGreaterThan(100);
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
});
