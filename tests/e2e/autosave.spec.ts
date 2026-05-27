import { test, expect } from '@playwright/test';
import { readFixture } from './helpers';

async function seedAutosave(page: import('@playwright/test').Page) {
  const project = JSON.parse(readFixture('reference.cartoproj'));
  await page.evaluate(async (entry) => {
    const request = indexedDB.open('keyval-store', 1);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => request.result.createObjectStore('keyval');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction('keyval', 'readwrite');
        tx.objectStore('keyval').put(entry, 'cartoproj:autosave:current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, {
    savedAt: '2026-05-27T08:00:00.000Z',
    fileName: 'autosaved-reference.cartoproj',
    project,
  });
}

test('restore an autosaved draft from IndexedDB', async ({ page }) => {
  await page.goto('/');
  await seedAutosave(page);
  await page.reload();

  await expect(page.getByTestId('recovery-prompt')).toBeVisible();
  await expect(page.getByText('autosaved-reference.cartoproj').first()).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).first().click();

  await expect(page.getByTestId('recovery-prompt')).toBeHidden();
  await expect(page.getByText('autosaved-reference.cartoproj').first()).toBeVisible();
  await expect(page.getByTestId('annotation-row')).toHaveCount(3);
  await expect(page.getByTestId('layer-row')).toContainText('Reference');
});

test('dismiss an autosaved draft from IndexedDB', async ({ page }) => {
  await page.goto('/');
  await seedAutosave(page);
  await page.reload();

  await expect(page.getByTestId('recovery-prompt')).toBeVisible();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByTestId('recovery-prompt')).toBeHidden();

  await page.reload();
  await expect(page.getByTestId('recovery-prompt')).toBeHidden();
});
