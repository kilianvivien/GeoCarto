import { test, expect } from '@playwright/test';
import { clickAnnotationStage, expectNoConsoleErrors, lockMap } from './helpers';

async function chooseTool(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).click();
}

test('context-menu grouping, ruler, and grid snap edit the document model', async ({ page }) => {
  const noConsoleErrors = await expectNoConsoleErrors(page);
  await page.goto('/');
  await lockMap(page);

  await page.evaluate(() => {
    const style = {
      fillColor: '#007aff',
      fillPattern: 'none' as const,
      hatchColor: '#0f172a',
      hatchSpacing: 10,
      strokeColor: '#0f172a',
      strokeWidth: 2,
      strokePattern: 'solid' as const,
      textColor: '#111827',
      textSize: 18,
      fontFamily: 'Inter',
      pinColor: '#ff3b30',
      pinIcon: 'dot' as const,
      haloColor: '#ffffff',
      haloWidth: 0,
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      blendMode: 'normal' as const,
      brushPreset: 'round' as const,
    };
    window.__documentStore.getState().addAnnotation({
      id: 'a-rect-1',
      kind: 'rectangle',
      name: 'Rectangle 1',
      visible: true,
      locked: false,
      anchorMode: 'canvas',
      position: { x: 260, y: 200 },
      geoAnchor: null,
      rotation: 0,
      opacity: 1,
      style,
      width: 160,
      height: 96,
      cornerRadius: 10,
    });
    window.__documentStore.getState().addAnnotation({
      id: 'a-rect-2',
      kind: 'rectangle',
      name: 'Rectangle 2',
      visible: true,
      locked: false,
      anchorMode: 'canvas',
      position: { x: 420, y: 200 },
      geoAnchor: null,
      rotation: 0,
      opacity: 1,
      style,
      width: 120,
      height: 80,
      cornerRadius: 10,
    });
  });

  const box = await page.getByTestId('annotation-stage').boundingBox();
  expect(box).not.toBeNull();
  await page.evaluate(() => {
    const ids = window.__documentStore.getState().project.annotations.map((item) => item.id);
    window.__documentStore.getState().setSelectedAnnotations(ids);
  });
  await expect
    .poll(() =>
      page.evaluate(() => window.__documentStore.getState().selectedAnnotationIds.length),
    )
    .toBe(2);

  await page.mouse.click(box!.x + 340, box!.y + 205, { button: 'right' });
  await expect(page.getByRole('menu', { name: 'Canvas selection menu' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Group selection', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__documentStore.getState().project.annotationGroups.length),
    )
    .toBe(1);

  await page.mouse.click(box!.x + 340, box!.y + 205, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Ungroup selection', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => window.__documentStore.getState().project.annotationGroups.length),
    )
    .toBe(0);

  await chooseTool(page, 'Ruler');
  await clickAnnotationStage(page, 500, 300);
  await clickAnnotationStage(page, 620, 335);
  await page.keyboard.press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__documentStore.getState().project.annotations.some((item) => item.kind === 'measurement'),
      ),
    )
    .toBe(true);

  await page.getByLabel('Grid spacing').fill('50');
  await page.getByLabel('Grid snap').evaluate((element) => (element as HTMLInputElement).click());
  await chooseTool(page, 'Rectangle');
  await clickAnnotationStage(page, 253, 203);
  const snapped = await page.evaluate(() => window.__documentStore.getState().project.annotations.at(-1));
  expect(snapped?.position).toEqual({ x: 250, y: 200 });

  noConsoleErrors();
});
