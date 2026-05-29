import { describe, expect, it } from 'vitest';
import { GeoJsonImportError, formatForFile, importFileToLayers } from './formats';

function file(content: string, name: string, type = 'text/plain'): File {
  return new File([content], name, { type });
}

describe('formatForFile', () => {
  it('maps extensions to formats', () => {
    expect(formatForFile(file('', 'a.geojson'))).toBe('geojson');
    expect(formatForFile(file('', 'a.json'))).toBe('geojson');
    expect(formatForFile(file('', 'a.topojson'))).toBe('topojson');
    expect(formatForFile(file('', 'a.kml'))).toBe('kml');
    expect(formatForFile(file('', 'a.gpx'))).toBe('gpx');
    expect(formatForFile(file('', 'a.zip'))).toBe('shapefile');
    expect(formatForFile(file('', 'a.shp'))).toBe('shapefile');
  });

  it('returns null for unsupported extensions', () => {
    expect(formatForFile(file('', 'a.txt'))).toBeNull();
    expect(formatForFile(file('', 'noextension'))).toBeNull();
  });
});

describe('importFileToLayers — TopoJSON', () => {
  // A minimal topology with one polygon object.
  const topology = JSON.stringify({
    type: 'Topology',
    objects: {
      counties: {
        type: 'GeometryCollection',
        geometries: [{ type: 'Polygon', arcs: [[0]], properties: { name: 'A' } }],
      },
    },
    arcs: [
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
        [0, 0],
      ],
    ],
  });

  it('decodes a topology into a polygon layer', async () => {
    const [layer] = await importFileToLayers(file(topology, 'shapes.topojson', 'application/json'));
    expect(layer.kind).toBe('geojson');
    expect(layer.geometry).toBe('polygon');
    expect(layer.featureCount).toBe(1);
    expect(layer.name).toBe('shapes');
  });

  it('rejects JSON without objects', async () => {
    await expect(
      importFileToLayers(file('{"type":"Topology"}', 'bad.topojson')),
    ).rejects.toBeInstanceOf(GeoJsonImportError);
  });
});

describe('importFileToLayers — KML', () => {
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Pin</name><Point><coordinates>2.35,48.85,0</coordinates></Point></Placemark>
</Document></kml>`;

  it('decodes a placemark into a point layer', async () => {
    const [layer] = await importFileToLayers(file(kml, 'places.kml'));
    expect(layer.geometry).toBe('point');
    expect(layer.featureCount).toBe(1);
    expect(layer.name).toBe('places');
  });

  it('rejects malformed XML', async () => {
    await expect(importFileToLayers(file('<kml><unclosed>', 'bad.kml'))).rejects.toBeInstanceOf(
      GeoJsonImportError,
    );
  });
});

describe('importFileToLayers — GPX', () => {
  const gpx = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="48.85" lon="2.35"><name>WP</name></wpt>
</gpx>`;

  it('decodes a waypoint into a point layer', async () => {
    const [layer] = await importFileToLayers(file(gpx, 'track.gpx'));
    expect(layer.geometry).toBe('point');
    expect(layer.featureCount).toBe(1);
  });
});

describe('importFileToLayers — unsupported', () => {
  it('rejects unknown extensions', async () => {
    await expect(importFileToLayers(file('x', 'a.txt'))).rejects.toBeInstanceOf(GeoJsonImportError);
  });
});
