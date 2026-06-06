import { test, expect } from '@playwright/test';
import { lockMap } from './helpers';

/**
 * Real-mouse proof that terra-draw receives map interactions while editing: a
 * click on the shape selects a feature, and a vertex drag commits a geometry
 * change back to the document. Seeds geometry directly so the click target is at
 * a known screen position (map centre).
 */
test('clicking a shape selects it and dragging a vertex commits geometry', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);

  // Seed a square polygon centred on the map viewport, then enter edit mode.
  await page.evaluate(() => {
    const win = window as unknown as {
      __documentStore: { getState: () => { lockMapArea: (v: unknown) => void }; setState: (fn: (s: { project: unknown }) => unknown) => void };
      __editStore: { getState: () => { enterEdit: (id: string) => void } };
    };
    win.__documentStore.getState().lockMapArea({ center: [2.35, 48.85], zoom: 14, bearing: 0, pitch: 0 });
    const layer = {
      id: 'L1', kind: 'geojson', name: 'Test Shapes', visible: true, locked: false,
      geometry: 'polygon', featureCount: 1,
      data: { type: 'FeatureCollection', features: [{ type: 'Feature', id: 'p1', properties: { name: 'Block' },
        geometry: { type: 'Polygon', coordinates: [[[2.346, 48.847], [2.354, 48.847], [2.354, 48.853], [2.346, 48.853], [2.346, 48.847]]] } }] },
      style: { fillColor: '#4f8cff', fillOpacity: 0.4, fillPattern: 'none', hatchColor: '#fff', hatchSpacing: 8, strokeColor: '#1b4', strokeWidth: 2, pointColor: '#07a', pointRadius: 5, showPoints: true },
    };
    win.__documentStore.setState((s) => ({ project: { ...(s.project as object), layers: [layer] } }));
    win.__editStore.getState().enterEdit('L1');
  });

  await expect(page.getByRole('toolbar', { name: 'Vector editing tools' })).toBeVisible();
  await page.waitForTimeout(250);

  const canvas = page.locator('.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Click the polygon body (map centre) — terra-draw should select the feature.
  await page.mouse.click(cx, cy);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as { __editStore: { getState: () => { selectedFeatureId: string | number | null } } };
        return win.__editStore.getState().selectedFeatureId;
      }),
    )
    .toBe('p1');

  // Drag a corner vertex outward and confirm the document geometry changed.
  const before = await page.evaluate(() => {
    const win = window as unknown as { __documentStore: { getState: () => { project: { layers: { data: { features: { geometry: { coordinates: number[][][] } }[] } }[] } } } };
    return JSON.stringify(win.__documentStore.getState().project.layers[0].data.features[0].geometry.coordinates);
  });

  // Top-left corner of the square is at the top-left of the screen square.
  const corner = await canvas.evaluate((el: HTMLElement, [bx, by]) => {
    // The polygon spans the centre ~60% of the canvas; the top-left vertex sits
    // near 30%/30% of the canvas. Drag from there outward.
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width * 0.36, y: r.top + r.height * 0.34, bx, by };
  }, [box.x, box.y] as const);

  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 40, corner.y - 40, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as { __documentStore: { getState: () => { project: { layers: { data: { features: { geometry: { coordinates: number[][][] } }[] } }[] } } } };
        return JSON.stringify(win.__documentStore.getState().project.layers[0].data.features[0].geometry.coordinates);
      }),
    )
    .not.toBe(before);

  // Delete the selected feature; it must leave the document and stay gone on exit.
  await page.evaluate(() => {
    const win = window as unknown as { __editStore: { getState: () => { selectFeature: (id: string) => void } } };
    win.__editStore.getState().selectFeature('p1');
  });
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const win = window as unknown as { __documentStore: { getState: () => { project: { layers: { featureCount: number }[] } } } };
        return win.__documentStore.getState().project.layers[0].featureCount;
      }),
    )
    .toBe(0);
});
