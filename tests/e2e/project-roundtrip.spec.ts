import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, openProjectFixture } from './helpers';

test.beforeEach(async ({ page }) => {
  await disableFileSystemAccess(page);
});

test('open a .cartoproj fixture and save through the download fallback', async ({ page }) => {
  await page.goto('/');
  await openProjectFixture(page);

  await expect(page.getByTestId('layer-row')).toContainText('Reference');
  await expect(page.getByTestId('annotation-row')).toHaveCount(3);

  await page.getByTestId('annotation-row').filter({ hasText: 'Fixture Label' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Roundtrip Label');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel(/Save project/).click(),
  ]);
  expect(download.suggestedFilename()).toBe('reference.cartoproj');

  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const saved = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    annotations: { name: string }[];
    layers: unknown[];
  };
  expect(saved.layers).toHaveLength(1);
  expect(saved.annotations.some((annotation) => annotation.name === 'Roundtrip Label')).toBe(true);
});
