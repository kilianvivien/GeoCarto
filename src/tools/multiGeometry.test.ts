import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { explodeForEditing, recombineFromParts, MODE_PROPERTY } from './multiGeometry';

function fc(...features: FeatureCollection['features']): FeatureCollection {
  return { type: 'FeatureCollection', features };
}

describe('explodeForEditing / recombineFromParts', () => {
  it('round-trips a single polygon unchanged', () => {
    const source = fc({
      type: 'Feature',
      id: 'a',
      properties: { name: 'Alpha' },
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    });
    const { parts, index } = explodeForEditing(source);
    expect(parts).toHaveLength(1);
    const back = recombineFromParts(parts, index);
    expect(back).toEqual(source);
  });

  it('explodes a MultiPolygon into parts and recombines preserving identity and order', () => {
    const source = fc({
      type: 'Feature',
      id: 'dept-75',
      properties: { name: 'Paris' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 0]]],
          [[[5, 5], [6, 5], [6, 6], [5, 5]]],
          [[[9, 9], [10, 9], [10, 10], [9, 9]]],
        ],
      },
    });
    const { parts, index } = explodeForEditing(source);
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.geometry.type === 'Polygon')).toBe(true);
    expect(parts.every((p) => p.properties?.[MODE_PROPERTY] === 'polygon')).toBe(true);

    const back = recombineFromParts(parts, index);
    expect(back).toEqual(source);
  });

  it('explodes a MultiLineString and a MultiPoint', () => {
    const source = fc(
      {
        type: 'Feature',
        id: 'l',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] },
      },
      {
        type: 'Feature',
        id: 'p',
        properties: {},
        geometry: { type: 'MultiPoint', coordinates: [[0, 0], [1, 1]] },
      },
    );
    const { parts, index } = explodeForEditing(source);
    expect(parts).toHaveLength(4);
    expect(recombineFromParts(parts, index)).toEqual(source);
  });

  it('keeps a Multi* parent as Multi* even when reduced to a single part', () => {
    const source = fc({
      type: 'Feature',
      id: 'm',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[0, 0], [1, 0], [1, 1], [0, 0]]],
          [[[5, 5], [6, 5], [6, 6], [5, 5]]],
        ],
      },
    });
    const { parts, index } = explodeForEditing(source);
    const remaining = parts.slice(0, 1); // delete the second part
    const back = recombineFromParts(remaining, index);
    expect(back.features).toHaveLength(1);
    expect(back.features[0].geometry.type).toBe('MultiPolygon');
    expect((back.features[0].geometry as { coordinates: unknown[] }).coordinates).toHaveLength(1);
  });

  it('assigns an id to a feature that lacks one', () => {
    const source = fc({
      type: 'Feature',
      properties: { name: 'no id' },
      geometry: { type: 'Point', coordinates: [3, 4] },
    });
    const { parts, index } = explodeForEditing(source);
    const back = recombineFromParts(parts, index);
    expect(back.features[0].id).toBeTruthy();
  });

  it('reflects a vertex move made on an exploded part', () => {
    const source = fc({
      type: 'Feature',
      id: 'a',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    });
    const { parts, index } = explodeForEditing(source);
    const moved = parts.map((p) => ({
      ...p,
      geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [2, 0], [1, 1], [0, 0]]] },
    }));
    const back = recombineFromParts(moved, index);
    expect((back.features[0].geometry as { coordinates: number[][][] }).coordinates[0][1]).toEqual([2, 0]);
  });

  it('drops a parent whose parts were all deleted', () => {
    const source = fc(
      {
        type: 'Feature',
        id: 'keep',
        properties: {},
        geometry: { type: 'Point', coordinates: [0, 0] },
      },
      {
        type: 'Feature',
        id: 'gone',
        properties: {},
        geometry: { type: 'Point', coordinates: [1, 1] },
      },
    );
    const { parts, index } = explodeForEditing(source);
    const survivors = parts.filter((p) => index.partToParent.get(String(p.id)) === 'keep');
    const back = recombineFromParts(survivors, index);
    expect(back.features).toHaveLength(1);
    expect(back.features[0].id).toBe('keep');
  });

  it('emits a freshly drawn feature with its mode marker stripped', () => {
    const source = fc({
      type: 'Feature',
      id: 'a',
      properties: {},
      geometry: { type: 'Point', coordinates: [0, 0] },
    });
    const { parts, index } = explodeForEditing(source);
    const withNew = [
      ...parts,
      {
        id: crypto.randomUUID(),
        type: 'Feature' as const,
        properties: { [MODE_PROPERTY]: 'polygon' },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[2, 2], [3, 2], [3, 3], [2, 2]]],
        },
      },
    ];
    const back = recombineFromParts(withNew, index);
    expect(back.features).toHaveLength(2);
    const drawn = back.features[1];
    expect(drawn.geometry.type).toBe('Polygon');
    // The mode marker is stripped; a stable fill key is stamped on instead.
    expect(drawn.properties?.mode).toBeUndefined();
    expect(drawn.properties?.['@id']).toBe(String(drawn.id));
  });

  it('passes a non-editable GeometryCollection through untouched', () => {
    const source = fc({
      type: 'Feature',
      id: 'gc',
      properties: { x: 1 },
      geometry: {
        type: 'GeometryCollection',
        geometries: [{ type: 'Point', coordinates: [0, 0] }],
      },
    });
    const { parts, index } = explodeForEditing(source);
    expect(parts).toHaveLength(0);
    const back = recombineFromParts(parts, index);
    expect(back).toEqual(source);
  });
});
