import { test, expect } from '@playwright/test';
import { dropGeoJsonFixture, lockMap, expectNoConsoleErrors } from './helpers';

/**
 * Vector editing (Phase 3 M17/M18). terra-draw geometry drags rely on real map
 * pixel interactions that are flaky to script, so we drive feature *selection*
 * through the exposed store (mirroring how terra-draw's own click does) and
 * exercise the rest — edit entry, the editing toolbar, attribute editing, undo,
 * and exit — through the real UI.
 */
test('enter edit mode, edit a feature attribute, undo it, and exit', async ({ page }) => {
  const assertNoErrors = await expectNoConsoleErrors(page);
  await page.goto('/');
  await lockMap(page);
  await dropGeoJsonFixture(page);

  // The layer row lives under the Layers tab.
  await page.getByRole('tab', { name: 'Layers' }).click();
  const row = page.getByTestId('layer-row').filter({ hasText: 'reference' });
  await expect(row).toBeVisible();

  // Enter edit mode from the layer row; the editing toolbar appears.
  await row.getByLabel('Edit features').click({ force: true });
  await expect(page.getByRole('toolbar', { name: 'Vector editing tools' })).toBeVisible();

  // The inspector prompts to pick a feature.
  await page.getByRole('tab', { name: 'Properties' }).click();
  await expect(page.getByText(/Select a feature on the map/)).toBeVisible();

  // Entering edit mode stamps stable ids; select the first feature as a click would.
  const firstId = await page.evaluate(() => {
    const win = window as unknown as {
      __documentStore: { getState: () => { project: { layers: { data: { features: { id?: string | number }[] } }[] } } };
      __editStore: { getState: () => { selectFeature: (id: string | number) => void } };
    };
    const id = win.__documentStore.getState().project.layers[0].data.features[0].id;
    if (id === undefined) throw new Error('feature was not assigned an id on edit entry');
    win.__editStore.getState().selectFeature(id);
    return String(id);
  });
  expect(firstId).toBeTruthy();

  // Editable attribute rows render for the selected feature.
  const firstValue = page.getByLabel('Attribute 1 value');
  await expect(firstValue).toBeVisible();
  await firstValue.fill('Renamed in editor');

  const hasEdit = async () =>
    page.evaluate((id) => {
      const win = window as unknown as {
        __documentStore: { getState: () => { project: { layers: { data: { features: { id?: string | number; properties: Record<string, unknown> | null }[] } }[] } } };
      };
      const feature = win.__documentStore
        .getState()
        .project.layers[0].data.features.find((f) => String(f.id) === id);
      return Object.values(feature?.properties ?? {}).includes('Renamed in editor');
    }, firstId);

  expect(await hasEdit()).toBe(true);

  // Add a new field and confirm an extra editable row appears.
  const valueCount = await page.getByLabel(/Attribute \d+ value/).count();
  await page.getByRole('button', { name: 'Add field' }).click();
  await expect(page.getByLabel(/Attribute \d+ value/)).toHaveCount(valueCount + 1);

  // Undo reverts the attribute edit in the document.
  await page.keyboard.press('ControlOrMeta+z');
  expect(await hasEdit()).toBe(false);

  // Exit edit mode via the toolbar; the toolbar disappears.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('toolbar', { name: 'Vector editing tools' })).toHaveCount(0);

  assertNoErrors();
});
