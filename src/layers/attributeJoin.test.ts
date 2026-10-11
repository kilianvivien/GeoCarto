import { describe, expect, it } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { parseCsv } from '@/import/csv';
import { countMatches, joinAttributes, suggestJoinKeys } from './attributeJoin';

function collection(...properties: Record<string, unknown>[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: properties.map((props) => ({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: [0, 0] },
    })),
  };
}

const departments = collection(
  { code_insee: '01', nom: 'Ain' },
  { code_insee: '75', nom: 'Paris' },
  { code_insee: '2A', nom: 'Corse-du-Sud' },
);

describe('joinAttributes', () => {
  it('copies the selected columns onto matching features only', () => {
    const table = parseCsv('dep;taux;rang\n75;12,5;1\n2a;9,1;2\n99;1;3\n');
    const result = joinAttributes(departments, table, {
      layerField: 'code_insee',
      tableColumn: 'dep',
      columns: ['dep', 'taux'],
    });

    expect(result.matched).toBe(2);
    expect(result.unusedRows).toBe(1);
    const [ain, paris, corse] = result.data.features.map((f) => f.properties);
    expect(ain).toEqual({ code_insee: '01', nom: 'Ain' });
    // Number key 75 meets text "75"; the key column itself is not duplicated.
    expect(paris).toEqual({ code_insee: '75', nom: 'Paris', taux: 12.5 });
    // Case-insensitive: "2a" in the table meets "2A" on the feature.
    expect(corse).toEqual({ code_insee: '2A', nom: 'Corse-du-Sud', taux: 9.1 });
  });

  it('matches codes whose leading zeros a spreadsheet stripped', () => {
    const table = parseCsv('dep,taux\n1,7.2\n');
    const result = joinAttributes(departments, table, { layerField: 'code_insee', tableColumn: 'dep', columns: ['taux'] });
    expect(result.data.features[0].properties).toMatchObject({ code_insee: '01', taux: 7.2 });
  });

  it('overwrites a same-named property, writes blanks as null, and leaves the input untouched', () => {
    const table = parseCsv('code_insee,nom,taux\n75,Ville de Paris,\n');
    const result = joinAttributes(departments, table, {
      layerField: 'code_insee',
      tableColumn: 'code_insee',
      columns: ['nom', 'taux'],
    });
    expect(result.data.features[1].properties).toEqual({ code_insee: '75', nom: 'Ville de Paris', taux: null });
    expect(departments.features[1].properties).toEqual({ code_insee: '75', nom: 'Paris' });
  });

  it('uses the first row for a duplicated key and ignores blank keys', () => {
    const table = parseCsv('dep,taux\n75,1\n75,2\n,3\n');
    const result = joinAttributes(departments, table, { layerField: 'code_insee', tableColumn: 'dep', columns: ['taux'] });
    expect(result.data.features[1].properties?.taux).toBe(1);
    expect(result.matched).toBe(1);
    expect(result.unusedRows).toBe(0);
  });
});

describe('join key helpers', () => {
  const table = parseCsv('label,dep,taux\nParis,75,12.5\nAin,01,7.2\nCorse-du-Sud,2A,9.1\n');

  it('counts matches for a key pairing', () => {
    expect(countMatches(departments.features, table, 'code_insee', 'dep')).toBe(3);
    expect(countMatches(departments.features, table, 'nom', 'taux')).toBe(0);
  });

  it('suggests the pairing with the most matches', () => {
    expect(suggestJoinKeys(departments.features, ['nom', 'code_insee'], table)).toEqual({
      layerField: 'nom',
      tableColumn: 'label',
    });
    const codesOnly = parseCsv('dep,taux\n75,12.5\n01,7.2\n');
    expect(suggestJoinKeys(departments.features, ['nom', 'code_insee'], codesOnly)).toEqual({
      layerField: 'code_insee',
      tableColumn: 'dep',
    });
    expect(suggestJoinKeys(departments.features, ['nom'], parseCsv('x\nnothing\n'))).toBeNull();
  });
});
