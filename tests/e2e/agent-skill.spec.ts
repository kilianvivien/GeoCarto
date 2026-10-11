import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, expectNoConsoleErrors } from './helpers';

const EXAMPLE = resolve(process.cwd(), 'skills/geocarto-maps/examples/minimal.cartoproj');

/**
 * The agent skill's example project is a compact, hand-written file: no ids,
 * no positions, no camera. Opening it must yield a finished map.
 */
test('an authored project opens as a finished map', async ({ page }) => {
  const assertNoErrors = await expectNoConsoleErrors(page);
  await disableFileSystemAccess(page);
  await page.goto('/');

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByLabel(/Open project/).click()]);
  await chooser.setFiles(EXAMPLE);

  // It opens straight into editing, with its layer styled and listed.
  await expect(page.getByRole('button', { name: 'Unlock Map' })).toBeVisible();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('layer-row')).toContainText('Sites');

  // Layout hints are resolved against the live surface, then written as plain values.
  const state = () =>
    page.evaluate(() => {
      const { project } = window.__documentStore.getState();
      const surface = document.querySelector('[data-testid="map-view"]')!.getBoundingClientRect();
      return {
        viewport: project.viewport,
        surface: { width: surface.width, height: surface.height },
        annotations: project.annotations.map((a) => ({ kind: a.kind, x: a.position.x, y: a.position.y })),
      };
    });
  await expect.poll(async () => (await state()).annotations.find((a) => a.kind === 'legend')?.x).toBeGreaterThan(200);
  const { viewport, surface, annotations } = await state();

  // "bounds": [-3.5, 42.5, 7.0, 50.5] → centered on it, whatever the window size.
  expect(viewport.center[0]).toBeCloseTo(1.75, 1);
  expect(viewport.center[1]).toBeGreaterThan(45.5);
  expect(viewport.center[1]).toBeLessThan(47.5);
  const [title, legend, credit] = annotations;
  expect(title).toMatchObject({ kind: 'titleblock', x: 24, y: 24 });
  expect(legend.x).toBeCloseTo(surface.width - 200 - 24, 0);
  expect(legend.y).toBe(24);
  expect(credit.x).toBe(24);
  // The credit is long enough to wrap, so room is left for two lines.
  expect(credit.y).toBeCloseTo(surface.height - 44 - 24, 0);

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-kilianvivien-Documents-GeoCarto/ed86d2e7-0dca-4dfc-8575-ed3740a1af9d/scratchpad/skill-example.png' });
  assertNoErrors();
});

test('Settings offers the agent skill as a download', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download skill (.zip)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('geocarto-skill.zip');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const archive = Buffer.concat(chunks);
  // A zip (PK signature) that contains the skill's entry point and validator.
  expect(archive.subarray(0, 2).toString('latin1')).toBe('PK');
  expect(archive.includes(Buffer.from('geocarto-maps/SKILL.md'))).toBe(true);
  expect(archive.includes(Buffer.from('geocarto-maps/scripts/validate.mjs'))).toBe(true);
});
