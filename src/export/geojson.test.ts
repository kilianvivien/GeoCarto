import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { featureCollectionToLayer, toFeatureCollection } from '@/import/geojson';
import { geojsonFileName, serializeLayerGeoJson } from './geojson';

const sample: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'town-hall',
      geometry: { type: 'Point', coordinates: [6, 48] },
      properties: { name: 'Hôtel de ville', category: 'civic' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
      properties: { name: 'Parc' },
    },
  ],
};

describe('serializeLayerGeoJson', () => {
  it('produces a valid, parseable FeatureCollection', () => {
    const layer = featureCollectionToLayer('Quartier', sample);
    const text = serializeLayerGeoJson(layer);
    const parsed = JSON.parse(text);
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features).toHaveLength(2);
  });

  it('round-trips import → export → re-import preserving ids and properties', () => {
    const layer = featureCollectionToLayer('Quartier', sample);
    const exported = serializeLayerGeoJson(layer);

    // Re-import the exported text exactly as the importer would.
    const reimported = featureCollectionToLayer('Quartier', toFeatureCollection(JSON.parse(exported)));

    expect(reimported.featureCount).toBe(layer.featureCount);
    for (let i = 0; i < layer.data.features.length; i += 1) {
      const before = layer.data.features[i];
      const after = reimported.data.features[i];
      // Stable identity survives the round trip…
      expect(after.id).toBe(before.id);
      // …as do user-facing attributes (name/category) and the @id fill key.
      expect(after.properties).toEqual(before.properties);
      expect(after.geometry).toEqual(before.geometry);
    }
  });
});

describe('geojsonFileName', () => {
  it('appends a .geojson extension and sanitizes the layer name', () => {
    expect(geojsonFileName('Quartier centre')).toBe('Quartier centre.geojson');
    expect(geojsonFileName('a/b:c')).toBe('a-b-c.geojson');
    expect(geojsonFileName('data.geojson')).toBe('data.geojson');
    expect(geojsonFileName('   ')).toBe('layer.geojson');
  });
});
