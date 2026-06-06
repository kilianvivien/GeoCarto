import { test, expect } from '@playwright/test';
import { clickAnnotationStage, lockMap } from './helpers';

async function chooseTool(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).click();
}

test('create, style, lock, hide, and delete annotations', async ({ page }) => {
  await page.goto('/');
  await lockMap(page);

  await chooseTool(page, 'Rectangle');
  await clickAnnotationStage(page, 260, 200);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Rectangle');

  await page.getByLabel('Name', { exact: true }).fill('Styled rectangle');
  await page.getByLabel('Width').first().fill('180');
  await page.getByRole('button', { name: 'Use #34c759' }).first().click();
  await expect(page.getByText('Styled rectangle')).toBeVisible();

  await chooseTool(page, 'Text');
  await clickAnnotationStage(page, 620, 120);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Text');

  await chooseTool(page, 'Pin');
  await clickAnnotationStage(page, 650, 360);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Pin');

  await chooseTool(page, 'Polygon');
  await clickAnnotationStage(page, 500, 220);
  await clickAnnotationStage(page, 560, 300);
  await clickAnnotationStage(page, 450, 310);
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Layers' }).click();
  await expect(page.getByTestId('annotation-row')).toHaveCount(4);
  await expect(page.getByTestId('annotation-row').filter({ hasText: 'Polygon' })).toHaveCount(1);

  const rectangleRow = () => page.getByTestId('annotation-row').filter({ hasText: 'Styled rectangle' });
  await rectangleRow().getByLabel('Lock annotation').click({ force: true });
  await rectangleRow().click();
  await expect(page.getByText(/Styled rectangle/)).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await rectangleRow().getByLabel('Unlock annotation').click({ force: true });
  await rectangleRow().getByLabel('Hide annotation').click({ force: true });
  await expect(rectangleRow().getByLabel('Show annotation')).toBeVisible();
  await rectangleRow().getByLabel('Show annotation').click({ force: true });
  await rectangleRow().getByLabel('Delete annotation').click({ force: true });

  await expect(page.getByTestId('annotation-row').filter({ hasText: 'Styled rectangle' })).toHaveCount(0);
});
