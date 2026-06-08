import { test, expect } from '@playwright/test';
import { clickAnnotationStage, disableFileSystemAccess, lockMap } from './helpers';

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
  await rectangleRow().getByText('Styled rectangle').click();
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

test('sample line, arrow, and pin annotations into a legend and save them', async ({ page }) => {
  await disableFileSystemAccess(page);
  await page.goto('/');
  await lockMap(page);

  await page.evaluate(() => {
    const style = {
      fillColor: '#ffffff',
      fillPattern: 'none',
      hatchColor: '#0f172a',
      hatchSpacing: 10,
      strokeColor: '#0f172a',
      strokeWidth: 3,
      strokePattern: 'solid',
      textColor: '#111827',
      textSize: 18,
      fontFamily: 'Inter',
      pinColor: '#ff3b30',
      pinIcon: 'dot',
      haloColor: '#ffffff',
      haloWidth: 0,
      shadowColor: '#000000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      blendMode: 'normal',
      brushPreset: 'round',
    } as const;
    const base = {
      visible: true,
      locked: false,
      anchorMode: 'canvas',
      geoAnchor: null,
      rotation: 0,
      opacity: 1,
      style,
    } as const;
    const store = window.__documentStore.getState();
    store.addAnnotation({
      ...base,
      id: 'legend-symbol-test-line',
      kind: 'line',
      name: 'Road line',
      position: { x: 250, y: 220 },
      points: [0, 0, 120, 0],
      style: { ...style, strokeColor: '#34c759', strokeWidth: 5, strokePattern: 'dashed' },
    });
    store.addAnnotation({
      ...base,
      id: 'legend-symbol-test-arrow',
      kind: 'arrow',
      name: 'Flow arrow',
      position: { x: 250, y: 270 },
      points: [0, 0, 120, 0],
      style: { ...style, strokeColor: '#ff9500', strokeWidth: 4, strokePattern: 'solid' },
    });
    store.addAnnotation({
      ...base,
      id: 'legend-symbol-test-pin',
      kind: 'pin',
      name: 'Capital pin',
      position: { x: 300, y: 330 },
      label: 'Capital',
      size: 30,
      style: { ...style, pinColor: '#af52de', pinIcon: 'star' },
    });
    store.addAnnotation({
      ...base,
      id: 'legend-symbol-test-legend',
      kind: 'legend',
      name: 'Legend',
      position: { x: 80, y: 80 },
      title: 'Legend',
      width: 220,
      entries: ['Line', 'Arrow', 'Pin'].map((label) => ({
        label,
        swatchColor: '#007aff',
        symbol: { kind: 'fill', fillColor: '#007aff', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
        fillStyle: { fillColor: '#007aff', fillPattern: 'none', hatchColor: '#0f172a', hatchSpacing: 10 },
        visible: true,
      })),
    });
    store.setSelectedAnnotations(['legend-symbol-test-legend']);
  });

  await expect(page.getByLabel('Sample selected annotation symbol for entry 1')).toBeVisible();
  await page.getByLabel('Sample selected annotation symbol for entry 1').click();
  await clickAnnotationStage(page, 310, 220);
  await page.getByLabel('Sample selected annotation symbol for entry 2').click();
  await clickAnnotationStage(page, 310, 270);
  await page.getByLabel('Sample selected annotation symbol for entry 3').click();
  await clickAnnotationStage(page, 300, 330);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel(/Save project/).click(),
  ]);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const saved = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    annotations: {
      id: string;
      kind: string;
      entries?: { symbol?: { kind?: string; pinIcon?: string; strokeColor?: string } }[];
    }[];
  };
  const legend = saved.annotations.find((annotation) => annotation.id === 'legend-symbol-test-legend');
  expect(legend?.kind).toBe('legend');
  expect(legend?.entries?.map((entry) => entry.symbol?.kind)).toEqual(['line', 'arrow', 'pin']);
  expect(legend?.entries?.[0].symbol?.strokeColor).toBe('#34c759');
  expect(legend?.entries?.[2].symbol?.pinIcon).toBe('star');
});
