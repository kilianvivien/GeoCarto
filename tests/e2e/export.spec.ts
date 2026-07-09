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
  let surfaceBox = await page.getByTestId('map-surface').boundingBox();
  expect(surfaceBox).not.toBeNull();
  expect(surfaceBox!.width / surfaceBox!.height).toBeCloseTo(4 / 3, 1);

  await page.evaluate(() => {
    type Store = {
      getState: () => {
        setExportFrameSize: (dims: { width: number; height: number }) => void;
      };
    };
    const store = (window as unknown as { __documentStore?: Store }).__documentStore;
    if (!store) throw new Error('document store not exposed for tests');
    store.getState().setExportFrameSize({ width: 1920, height: 1080 });
  });
  surfaceBox = await page.getByTestId('map-surface').boundingBox();
  expect(surfaceBox).not.toBeNull();
  expect(surfaceBox!.width / surfaceBox!.height).toBeCloseTo(16 / 9, 1);

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(dialog).toBeVisible();
  const expectedSize = { width: 1920, height: 1080 };
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
  const scaledSize = { width: 1200, height: 900 };

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
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

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
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

test('export a vector PDF with real (non-flattened) content', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);

  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await dialog.getByRole('button', { name: 'PDF' }).click();
  // Vector is the default PDF mode.
  await expect(dialog.getByRole('button', { name: 'Vector', exact: true })).toHaveClass(/bg-\[var\(--accent\)\]/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Reference Project.pdf');
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
  expect(buffer.length).toBeGreaterThan(100);
});
