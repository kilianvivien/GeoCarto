import { test, expect, type Page } from '@playwright/test';
import { lockMap } from './helpers';

/**
 * iPad/tablet input paths: annotation tools act on tap, two fingers pan and
 * pinch-zoom the workspace, and a long-press opens the context menus that a
 * right-click gives on desktop. Touches are synthesized through CDP so they
 * carry real `pointerType: "touch"` pointer events, exactly like a finger on
 * iPadOS/Chromium.
 */
test.use({ hasTouch: true });

async function chooseTool(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).click();
}

async function stagePoint(page: Page, xOffset: number, yOffset: number) {
  const box = await page.getByTestId('annotation-stage').boundingBox();
  if (!box) throw new Error('annotation stage not visible');
  return { x: box.x + xOffset, y: box.y + yOffset };
}

test('a tap places an annotation and a second tap selects it', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);

  await chooseTool(page, 'Rectangle');
  const at = await stagePoint(page, 260, 200);
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Rectangle');

  // Placement hands back to the move tool; tapping elsewhere deselects and
  // tapping the shape re-selects it.
  const outside = await stagePoint(page, 60, 40);
  await page.touchscreen.tap(outside.x, outside.y);
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
  await page.touchscreen.tap(at.x + 40, at.y + 40);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Rectangle');
});

test('a two-finger pinch zooms the workspace without firing the active tool', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);

  // A drawing tool is armed on purpose: the pinch must not place anything.
  await chooseTool(page, 'Rectangle');

  const zoomReadout = page.locator('span.mono').filter({ hasText: /%$/ });
  await expect(zoomReadout).toHaveText('100%');

  const center = await stagePoint(page, 300, 220);
  const client = await page.context().newCDPSession(page);
  const finger = (offset: number) => ({ x: center.x + offset, y: center.y, id: offset < 0 ? 0 : 1 });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [finger(-40), finger(40)],
  });
  for (let step = 1; step <= 6; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [finger(-40 - step * 15), finger(40 + step * 15)],
    });
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(zoomReadout).not.toHaveText('100%');
  // The armed rectangle tool must not have placed an annotation.
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('annotation-row')).toHaveCount(0);
});

test('a long-press on an annotation opens its context menu', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);

  await chooseTool(page, 'Rectangle');
  const at = await stagePoint(page, 260, 200);
  await page.touchscreen.tap(at.x, at.y);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Rectangle');

  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: at.x + 40, y: at.y + 40, id: 0 }],
  });
  // Hold still past the long-press threshold (500 ms).
  await page.waitForTimeout(700);
  await expect(page.getByRole('menu', { name: 'Canvas selection menu' })).toBeVisible();
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // Lifting the finger must not dismiss the menu or re-fire the tap.
  await expect(page.getByRole('menu', { name: 'Canvas selection menu' })).toBeVisible();
});
