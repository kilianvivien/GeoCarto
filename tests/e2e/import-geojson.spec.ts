import { test, expect } from '@playwright/test';

const sample = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Zone A' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 45],
            [6, 45],
            [6, 50],
            [0, 50],
            [0, 45],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Paris' },
      geometry: { type: 'Point', coordinates: [2.35, 48.85] },
    },
  ],
};

test('import a GeoJSON file via the picker', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import GeoJSON' }).click(),
  ]);
  await chooser.setFiles({
    name: 'demo.geojson',
    mimeType: 'application/geo+json',
    buffer: Buffer.from(JSON.stringify(sample)),
  });

  // The layer appears in the panel and the status bar reflects the feature count.
  await expect(page.getByRole('treeitem')).toContainText('demo');
  await expect(page.getByTestId('feature-count')).toHaveText('2 features');
});
