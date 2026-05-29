import { describe, expect, it } from 'vitest';
import { importGeoJsonFile, GeoJsonImportError } from './geojson';

function file(content: unknown, name = 'sample.geojson'): File {
  return new File([JSON.stringify(content)], name, { type: 'application/json' });
}

const point = { type: 'Point', coordinates: [0, 0] };
const polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };

describe('importGeoJsonFile', () => {
  it('imports a FeatureCollection and detects point geometry', async () => {
    const layer = await importGeoJsonFile(
      file({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: point, properties: { name: 'A' } }],
      }),
    );
    expect(layer.kind).toBe('geojson');
    expect(layer.geometry).toBe('point');
    expect(layer.featureCount).toBe(1);
    expect(layer.name).toBe('sample');
  });

  it('wraps a bare Feature into a collection', async () => {
    const layer = await importGeoJsonFile(
      file({ type: 'Feature', geometry: polygon, properties: {} }),
    );
    expect(layer.geometry).toBe('polygon');
    expect(layer.featureCount).toBe(1);
  });

  it('wraps a bare geometry into a collection', async () => {
    const layer = await importGeoJsonFile(file(point));
    expect(layer.featureCount).toBe(1);
    expect(layer.geometry).toBe('point');
  });

  it('classifies collections with multiple families as mixed', async () => {
    const layer = await importGeoJsonFile(
      file({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: point, properties: {} },
          { type: 'Feature', geometry: polygon, properties: {} },
        ],
      }),
    );
    expect(layer.geometry).toBe('mixed');
    expect(layer.style.showPoints).toBe(false);
  });

  it('keeps point-only layers visible by default', async () => {
    const layer = await importGeoJsonFile(
      file({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: point, properties: {} }],
      }),
    );
    expect(layer.style.showPoints).toBe(true);
  });

  it('rejects invalid JSON', async () => {
    const bad = new File(['{not json'], 'bad.json');
    await expect(importGeoJsonFile(bad)).rejects.toBeInstanceOf(GeoJsonImportError);
  });

  it('rejects an empty collection', async () => {
    await expect(
      importGeoJsonFile(file({ type: 'FeatureCollection', features: [] })),
    ).rejects.toBeInstanceOf(GeoJsonImportError);
  });

  it('rejects unrecognized shapes', async () => {
    await expect(importGeoJsonFile(file({ type: 'Banana' }))).rejects.toBeInstanceOf(
      GeoJsonImportError,
    );
  });
});
