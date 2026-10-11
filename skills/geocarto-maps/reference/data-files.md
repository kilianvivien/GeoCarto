# Data files

Two formats cover almost every case. GeoCarto also reads TopoJSON, KML, GPX, and zipped Shapefiles,
but there is no reason to produce those.

## GeoJSON — shapes with attributes

A `FeatureCollection` in WGS84 (EPSG:4326), coordinates in `[longitude, latitude]` order.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "code": "75", "name": "Paris", "population": 2102650, "density": 19943.5, "type": "urban" },
      "geometry": { "type": "Polygon", "coordinates": [[[2.22, 48.81], [2.47, 48.81], [2.47, 48.90], [2.22, 48.90], [2.22, 48.81]]] }
    }
  ]
}
```

- Any geometry type works, and types can be mixed in one file, but one geometry family per file
  (points, lines, or polygons) gives the cleanest layer.
- **Properties must be flat**: text, numbers, booleans, or `null`. No nested objects or arrays.
- Use the same property names on every feature. A missing value is `null`, not `""`, `"N/A"`, or `0`.
- Give features a human-readable name property (`name`, `nom`, `label`): labels default to it.
- Do not add `id` or `@id`: GeoCarto assigns its own.
- Do not include a `crs` member. It is ignored; coordinates are always read as WGS84.
- Keep files under 75 MB. Simplify geometry meant for a regional or national map: a vertex every few
  meters is invisible at that scale and makes everything slower.

What each styling option needs:

| Style | Needs | Notes |
| --- | --- | --- |
| Color by value (choropleth) | a numeric attribute on polygons | use a rate, not a raw count |
| Size by value (proportional symbols) | a numeric attribute ≥ 0 on points | raw counts are fine here |
| Color by category | an attribute with 2–12 distinct text values | polygons, lines, or points |
| Labels | any attribute; optionally a second one for a value line | |
| Heatmap | points only | no attribute needed |

## CSV — tables

Comma-, semicolon-, or tab-separated, with a header row, UTF-8. With `;` as the separator, decimal
commas are understood (`48,8566`).

### Points: a table with coordinates

Include a latitude and a longitude column under one of these names (case and accents ignored):

- latitude: `lat`, `latitude` (or `y`)
- longitude: `lon`, `lng`, `long`, `longitude` (or `x`)

```csv
name,type,lat,lon,visitors
Louvre,museum,48.8606,2.3376,8900000
Chambord,palace,47.6161,1.5170,1100000
```

Every other column becomes a feature property. Rows without valid coordinates are skipped (and reported).

### Points: a table with addresses

Without coordinate columns, GeoCarto geocodes rows from `address`/`adresse`, `postcode`/`code postal`,
`city`/`ville`/`commune`, and `country`/`pays` columns (or a single `place`/`lieu`/`name`/`nom` column).
This is slow, approximate, needs a network connection, and is limited to **200 rows**. If you can
look the coordinates up yourself, add `lat`/`lon` columns instead.

### Join: a table to attach to an existing layer

No location columns are needed, only a **key column** whose values match a property of the layer's
features (a region code, a country ISO code, a name).

```csv
code;rate;rank
01;7,2;14
75;12,5;3
```

- Matching ignores case and surrounding spaces, and tolerates stripped leading zeros (`1` matches `"01"`).
- Prefer codes over names as keys: names vary in spelling, accents, and articles.
- One row per feature. If a key repeats, only its first row is used.
- A joined column overwrites a property of the same name, so re-joining updated data just works.
