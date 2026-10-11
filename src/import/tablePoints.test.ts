import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCsv } from './csv';
import { GeoJsonImportError, formatForFile, importFileToLayers } from './formats';
import { GEOCODE_ROW_LIMIT, geocodeTable, locationColumns } from './geocodeTable';
import { ImportCancelledError } from './importJob';
import { ImportParseError, coordinateColumns, tableToPoints } from './parse';

const search = vi.hoisted(() => vi.fn());
vi.mock('@/geocode/photon', () => ({ photonProvider: { search } }));

const file = (text: string, name = 'places.csv') => new File([text], name, { type: 'text/csv' });
const found = (lng: number, lat: number) => [{ id: 'x', label: 'x', kind: 'city', center: [lng, lat] }];

afterEach(() => search.mockReset());

describe('tableToPoints', () => {
  it('detects coordinate columns under their common names', () => {
    expect(coordinateColumns(parseCsv('Name,Latitude,Longitude\nA,1,2\n'))).toEqual({ latitude: 'Latitude', longitude: 'Longitude' });
    expect(coordinateColumns(parseCsv('nom;lat;lng\nA;1;2\n'))).toEqual({ latitude: 'lat', longitude: 'lng' });
    expect(coordinateColumns(parseCsv('id,X,Y\n1,2,3\n'))).toEqual({ latitude: 'Y', longitude: 'X' });
    // Explicit names win over a stray x/y pair.
    expect(coordinateColumns(parseCsv('x,y,lat,lon\n0,0,48,2\n'))).toEqual({ latitude: 'lat', longitude: 'lon' });
    expect(coordinateColumns(parseCsv('name,lat\nA,1\n'))).toBeNull();
  });

  it('makes one point per row, lon/lat ordered, keeping every column', () => {
    const { data, skippedRows } = tableToPoints(parseCsv('ville;lat;lon;pop\nParis;48,8566;2,3522;2100000\n'));
    expect(skippedRows).toBe(0);
    expect(data.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
        properties: { ville: 'Paris', lat: 48.8566, lon: 2.3522, pop: 2100000 },
      },
    ]);
  });

  it('reads quoted decimal commas and skips rows without a valid position', () => {
    const table = parseCsv('name,lat,lon\nA,"48,5","2,5"\nB,,3\nC,95,3\nD,north,3\n');
    const { data, skippedRows } = tableToPoints(table);
    expect(data.features.map((f) => f.properties?.name)).toEqual(['A']);
    expect(data.features[0].geometry).toEqual({ type: 'Point', coordinates: [2.5, 48.5] });
    expect(skippedRows).toBe(3);
  });

  it('reports missing columns and all-invalid tables distinctly', () => {
    expect(() => tableToPoints(parseCsv('name,city\nA,Paris\n'))).toThrow(
      expect.objectContaining({ code: 'noCoordinateColumns' }) as ImportParseError,
    );
    expect(() => tableToPoints(parseCsv('lat,lon\nx,y\n'))).toThrow(
      expect.objectContaining({ code: 'noValidCoordinates' }) as ImportParseError,
    );
  });
});

describe('geocodeTable', () => {
  it('builds the query from address parts in postal order', () => {
    expect(locationColumns(parseCsv('Pays,Ville,Adresse,Code postal,note\nFrance,Lyon,1 rue X,69001,n\n'))).toEqual([
      'Adresse', 'Code postal', 'Ville', 'Pays',
    ]);
    expect(locationColumns(parseCsv('lieu,valeur\nLyon,3\n'))).toEqual(['lieu']);
    // A country alone is too vague to geocode row by row.
    expect(locationColumns(parseCsv('country,value\nFrance,3\n'))).toEqual([]);
  });

  it('places found rows, skips unknown ones, and looks each address up once', async () => {
    search.mockImplementation(async (query: string) => (query.startsWith('Lyon') ? found(4.83, 45.76) : []));
    const table = parseCsv('ville,pays,n\nLyon,France,1\nNowhere,France,2\nLyon,France,3\n');
    const progress = vi.fn();

    const { data, skippedRows } = await geocodeTable(table, ['ville', 'pays'], { onProgress: progress });

    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[0][0]).toBe('Lyon, France');
    expect(data.features.map((f) => [f.properties?.n, f.geometry])).toEqual([
      [1, { type: 'Point', coordinates: [4.83, 45.76] }],
      [3, { type: 'Point', coordinates: [4.83, 45.76] }],
    ]);
    expect(skippedRows).toBe(1);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('keeps going when one lookup fails, and stops when cancelled', async () => {
    search.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(found(1, 2));
    const table = parseCsv('ville\nA\nB\n');
    expect((await geocodeTable(table, ['ville'])).data.features).toHaveLength(1);

    const controller = new AbortController();
    controller.abort();
    await expect(geocodeTable(table, ['ville'], { signal: controller.signal })).rejects.toBeInstanceOf(ImportCancelledError);
  });
});

describe('importFileToLayers — CSV', () => {
  it('recognizes CSV and TSV files', () => {
    expect(formatForFile(file('', 'a.csv'))).toBe('csv');
    expect(formatForFile(file('', 'a.TSV'))).toBe('csv');
  });

  it('imports a coordinate table as a point layer and notes skipped rows', async () => {
    const onNote = vi.fn();
    const [layer] = await importFileToLayers(file('name,lat,lon\nA,48,2\nB,,\n', 'sites.csv'), { onNote });
    expect(layer).toMatchObject({ name: 'sites', geometry: 'point', featureCount: 1 });
    expect(layer.data.features[0].id).toBeDefined();
    expect(onNote).toHaveBeenCalledWith('1 row(s) of sites.csv had no usable location and were left out.');
    expect(search).not.toHaveBeenCalled();
  });

  it('geocodes a table that only names places', async () => {
    search.mockResolvedValue(found(4.83, 45.76));
    const [layer] = await importFileToLayers(file('ville,valeur\nLyon,3\n'));
    expect(layer.featureCount).toBe(1);
    expect(layer.data.features[0].geometry).toEqual({ type: 'Point', coordinates: [4.83, 45.76] });
  });

  it('refuses tables it cannot place, with a message that says why', async () => {
    await expect(importFileToLayers(file('code,valeur\n01,3\n'))).rejects.toThrow(/no latitude\/longitude columns/);
    const big = `ville\n${Array.from({ length: GEOCODE_ROW_LIMIT + 1 }, (_, i) => `V${i}`).join('\n')}\n`;
    await expect(importFileToLayers(file(big))).rejects.toThrow(new RegExp(`limit is ${GEOCODE_ROW_LIMIT}`));
    search.mockResolvedValue([]);
    await expect(importFileToLayers(file('ville\nNowhere\n'))).rejects.toThrow(/could be located/);
    await expect(importFileToLayers(file('', 'empty.csv'))).rejects.toBeInstanceOf(GeoJsonImportError);
  });
});
