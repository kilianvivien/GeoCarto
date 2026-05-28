import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, openProjectFixture } from './helpers';

function pngDimensions(buffer: Buffer) {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('export a PNG from the locked composition frame', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);

  await page.getByTitle('Export (⌘E)').click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(dialog).toBeVisible();
  const canvasBox = await page.getByTestId('map-view').boundingBox();
  expect(canvasBox).not.toBeNull();
  const expectedSize = {
    width: Math.round(canvasBox!.width),
    height: Math.round(canvasBox!.height),
  };
  await expect(page.getByTestId('export-output-size')).toHaveText(`${expectedSize.width} × ${expectedSize.height}`);

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
  expect(pngDimensions(buffer)).toEqual(expectedSize);
});

test('export custom transparent PNG and JPEG variants', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);
  const canvasBox = await page.getByTestId('map-view').boundingBox();
  expect(canvasBox).not.toBeNull();
  const scaledSize = {
    width: Math.round(canvasBox!.width * 1.5),
    height: Math.round(canvasBox!.height * 1.5),
  };

  await page.getByTitle('Export (⌘E)').click();
  let dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
  await dialog.getByRole('spinbutton').fill('1.5');
  await dialog.getByRole('button', { name: 'Transparent' }).click();
  await expect(page.getByTestId('export-output-size')).toHaveText(`${scaledSize.width} × ${scaledSize.height}`);
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  const pngStream = await pngDownload.createReadStream();
  expect(pngStream).not.toBeNull();
  const pngChunks: Buffer[] = [];
  for await (const chunk of pngStream!) pngChunks.push(Buffer.from(chunk));
  expect(pngDimensions(Buffer.concat(pngChunks))).toEqual(scaledSize);

  await page.getByTitle('Export (⌘E)').click();
  dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'JPEG' }).click();
  const [jpgDownload] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  expect(jpgDownload.suggestedFilename()).toBe('Reference Project.jpg');
  const jpgStream = await jpgDownload.createReadStream();
  expect(jpgStream).not.toBeNull();
  const jpgChunks: Buffer[] = [];
  for await (const chunk of jpgStream!) jpgChunks.push(Buffer.from(chunk));
  const jpg = Buffer.concat(jpgChunks);
  expect(jpg[0]).toBe(0xff);
  expect(jpg[1]).toBe(0xd8);
});
