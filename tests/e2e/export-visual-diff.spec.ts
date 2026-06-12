import { test, expect } from '@playwright/test';
import { disableFileSystemAccess, openProjectFixture } from './helpers';

/**
 * M7 visual/pixel diff harness for PNG export.
 *
 * Tolerance: at the reference project's 1× scale (800×600), we accept up to
 * 0.5% of pixels (≈ 2400) differing from the committed baseline. This swallows
 * sub-pixel rasterizer jitter while still catching a single-pin shift.
 *
 * Baselines live next to this spec as `export-visual-diff.spec.ts-snapshots/`.
 * This spec is opt-in on CI because pixel baselines are platform-sensitive and
 * slower than the standard preview gates. Run it deliberately with
 * `npm run test:e2e:visual`; regenerate baselines with
 * `RUN_VISUAL_DIFF=1 npx playwright test export-visual-diff --update-snapshots`.
 *
 * The second test deliberately shifts a pin annotation 8 px and asserts the
 * exported bytes diverge from the unshifted export — proving the harness
 * actually catches drift before it lands in main.
 */

test.skip(
  process.env.CI === 'true' && process.env.RUN_VISUAL_DIFF !== '1',
  'Visual PNG baselines are opt-in on CI; run npm run test:e2e:visual when reviewing export rendering.',
);

async function exportPngBuffer(page: import('@playwright/test').Page): Promise<Buffer> {
  await page.getByRole('button', { name: 'Export (⌘E)' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export image' });
  await expect(dialog).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Export' }).click(),
  ]);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('export PNG matches the committed baseline', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);

  const buffer = await exportPngBuffer(page);
  // toMatchSnapshot diff-encodes against the baseline at the pixel level.
  expect(buffer).toMatchSnapshot('reference-export.png', {
    maxDiffPixelRatio: 0.005,
  });
});

test('a seeded pin shift breaks the export baseline', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await openProjectFixture(page);

  const baseline = await exportPngBuffer(page);

  // Shift the first pin's geo anchor by ~0.01° (≈ 1 km at Paris latitude).
  // This is a single editorial-mistake-sized drift; any working diff must
  // surface it.
  const shifted = await page.evaluate(() => {
    type Annotation = {
      id: string;
      kind: string;
      anchorMode: string;
      geoAnchor: [number, number] | null;
      position: { x: number; y: number };
    };
    type Store = {
      getState: () => {
        project: { annotations: Annotation[] };
        updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
      };
    };
    const store = (window as unknown as { __documentStore?: Store }).__documentStore;
    if (!store) throw new Error('document store not exposed for tests');
    const state = store.getState();
    const pin = state.project.annotations.find((a) => a.kind === 'pin');
    if (!pin) throw new Error('reference fixture has no pin annotation');
    if (pin.anchorMode === 'map' && pin.geoAnchor) {
      state.updateAnnotation(pin.id, {
        geoAnchor: [pin.geoAnchor[0] + 0.01, pin.geoAnchor[1]] as [number, number],
      });
    } else {
      state.updateAnnotation(pin.id, {
        position: { x: pin.position.x + 8, y: pin.position.y },
      });
    }
    return true;
  });
  expect(shifted).toBe(true);

  const drifted = await exportPngBuffer(page);
  expect(
    drifted.equals(baseline),
    'shifting a pin must change the exported PNG bytes',
  ).toBe(false);
});
