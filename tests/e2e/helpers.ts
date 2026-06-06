import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const fixturePath = (name: string) => resolve(process.cwd(), 'tests', 'fixtures', name);

export function readFixture(name: string): string {
  return readFileSync(fixturePath(name), 'utf8');
}

export async function disableFileSystemAccess(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
}

export async function expectNoConsoleErrors(page: Page) {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  return () => expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
}

export async function lockMap(page: Page) {
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Lock Map Area' }).click();
  await expect(page.getByRole('button', { name: 'Unlock Map' })).toBeVisible();
}

export async function openProjectFixture(page: Page, name = 'reference.cartoproj') {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByLabel(/Open project/).click(),
  ]);
  await chooser.setFiles(fixturePath(name));
  await expect(page.locator('.font-medium').filter({ hasText: name })).toBeVisible();
}

export async function importGeoJsonFixture(page: Page, name = 'reference.geojson') {
  await page.getByRole('tab', { name: 'Layers' }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import data' }).click(),
  ]);
  await chooser.setFiles(fixturePath(name));
}

export async function dropGeoJsonFixture(page: Page, name = 'reference.geojson') {
  const json = readFixture(name);
  await page.getByTestId('map-canvas').dispatchEvent('drop', {
    dataTransfer: await page.evaluateHandle(
      ({ fileName, contents }) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([contents], fileName, { type: 'application/geo+json' }));
        return transfer;
      },
      { fileName: name, contents: json },
    ),
  });
}

export async function clickAnnotationStage(page: Page, xOffset: number, yOffset: number) {
  const box = await page.getByTestId('annotation-stage').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + xOffset, box!.y + yOffset);
}
