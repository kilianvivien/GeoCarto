import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses comma-separated rows and coerces numbers', () => {
    const table = parseCsv('code,name,population\nFR,France,68.4\nDE,Germany,84\n');
    expect(table.columns).toEqual(['code', 'name', 'population']);
    expect(table.rows).toEqual([
      { code: 'FR', name: 'France', population: 68.4 },
      { code: 'DE', name: 'Germany', population: 84 },
    ]);
  });

  it('sniffs semicolons and reads decimal commas (French spreadsheet export)', () => {
    const table = parseCsv(String.fromCharCode(0xfeff) + 'code;nom;taux\r\n01;Ain;7,2\r\n75;Paris;12,5\r\n');
    expect(table.columns).toEqual(['code', 'nom', 'taux']);
    // The leading-zero code stays text; the rate becomes a number.
    expect(table.rows[0]).toEqual({ code: '01', nom: 'Ain', taux: 7.2 });
    expect(table.rows[1]).toEqual({ code: 75, nom: 'Paris', taux: 12.5 });
  });

  it('does not read a comma as a decimal mark in a comma-separated file', () => {
    const table = parseCsv('id,pair\n1,"3,5"\n');
    expect(table.rows[0]).toEqual({ id: 1, pair: '3,5' });
  });

  it('handles quoted fields with delimiters, escaped quotes, and newlines', () => {
    const table = parseCsv('name,note\n"Doe, Jane","said ""hi""\nthen left"\n');
    expect(table.rows).toEqual([{ name: 'Doe, Jane', note: 'said "hi"\nthen left' }]);
  });

  it('parses tab-separated values and skips blank lines', () => {
    const table = parseCsv('a\tb\n\n1\t2\n\n');
    expect(table.rows).toEqual([{ a: 1, b: 2 }]);
  });

  it('names blank and duplicate headers and pads short rows', () => {
    const table = parseCsv('id,,id\n7\n');
    expect(table.columns).toEqual(['id', 'column_2', 'id_2']);
    expect(table.rows[0]).toEqual({ id: 7, column_2: '', id_2: '' });
  });

  it('rejects files with no header or no data rows', () => {
    expect(() => parseCsv('')).toThrow(CsvParseError);
    expect(() => parseCsv('a,b\n')).toThrow(CsvParseError);
  });
});
