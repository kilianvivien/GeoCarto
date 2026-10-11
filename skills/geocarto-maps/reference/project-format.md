# Project files (`.cartoproj`)

A `.cartoproj` is one JSON document: the map's framing, its data layers with their styling, and the
annotations drawn on top. When you author one, **only `version` is required**. Leave out anything you
have no opinion about; GeoCarto completes it on open. Start from `examples/minimal.cartoproj`.

```json
{
  "version": 1,
  "meta": { "name": "Museums and palaces" },
  "viewport": { "bounds": [-1.5, 43.0, 6.5, 50.0] },
  "layers": [ … ],
  "annotations": [ … ]
}
```

## Framing

| Field | Meaning |
| --- | --- |
| `viewport.bounds` | `[west, south, east, north]` in degrees. The map is fitted to it on open. **Use this.** |
| `viewport.center`, `viewport.zoom` | An explicit camera instead of bounds. The visible extent then depends on the user's window. |
| `exportFrame` | `{ "width": 1600, "height": 1200 }` — output size in pixels. Sets the map's aspect ratio. Default 1600 × 1200. |
| `basemap` | `{ "kind": "builtin", "preset": "editorial-light" }`. Presets: `editorial-light` (default), `editorial-dark`, `minimal-grey`, `print-bw`. Use `{ "kind": "empty" }` for no basemap. |

Pad the bounds a little beyond the data, so shapes do not touch the frame edge.
Prefer `minimal-grey` or `print-bw` under a choropleth: a colorful basemap fights with data colors.

## Layers

Layers draw bottom to top in list order. Put polygons first, then lines, then points.

```json
{
  "id": "sites",
  "name": "Sites",
  "data": { "type": "FeatureCollection", "features": [ … ] },
  "style": { … }
}
```

- `data` is the layer's GeoJSON, inline. It follows every rule in `data-files.md`.
- `id` is optional; give one when a legend needs to refer to the layer.

### `style`

All optional. Colors are hex strings.

| Field | Default | |
| --- | --- | --- |
| `fillColor`, `fillOpacity` | `#007aff`, `0.25` | polygon fill |
| `strokeColor`, `strokeWidth` | `#007aff`, `1.5` | lines and polygon outlines |
| `pointColor`, `pointRadius`, `showPoints` | `#007aff`, `5`, `true` | point symbols |
| `dataStyle` | none | data-driven styling, one of the three below |
| `labels` | none | attribute labels |

### `style.dataStyle` — one of

**Color by value** (polygons; needs a numeric attribute):

```json
{ "kind": "choropleth", "attribute": "density", "method": "quantile", "classCount": 5, "paletteId": "blues" }
```

`method`: `quantile` (default), `equal`, `jenks`, or `manual` (then give ascending `breaks`).
`classCount`: 3–9. Breaks are computed for you unless the method is `manual`.
`paletteId` — sequential: `blues` (default), `greens`, `oranges`, `purples`, `ylorrd`;
diverging (for values around a midpoint): `rdbu`, `prgn`, `brbg`. `reverse: true` flips it.
`missingColor` (default `#cccccc`) paints features with no value.

**Size by value** (points; needs a numeric attribute ≥ 0):

```json
{ "kind": "proportional", "attribute": "visitors", "minRadius": 4, "maxRadius": 28, "scale": "sqrt", "color": "#e4572e" }
```

Keep `scale` at `sqrt` so symbol *area* is proportional to the value; `linear` exaggerates large values.

**Color by category** (any geometry; needs an attribute with few distinct values):

```json
{
  "kind": "categorical",
  "attribute": "type",
  "categories": [
    { "value": "museum", "color": "#1f77b4" },
    { "value": "palace", "color": "#e4572e" }
  ],
  "otherColor": "#bbbbbb"
}
```

Values are matched exactly, as text, case-sensitively. Colors must be 6-digit hex. Features whose
value is not listed get `otherColor`. Omit `categories` entirely to have the most frequent values
colored automatically. List categories in the order the legend should show them.

### `style.labels`

```json
{ "attribute": "name", "valueAttribute": "visitors", "valueSuffix": " visitors", "size": 12, "color": "#1c1c1e", "halo": true }
```

`attribute` is the first line; `valueAttribute` adds a second line (numbers are rounded to two
decimals and formatted for the user's locale), with `valueSuffix` appended. `size` is 6–48.
On screen, labels that would overlap are hidden; SVG and vector-PDF exports contain all of them.

## Annotations

Map furniture and notes. Each needs a `kind`; give it a position in one of two ways:

- **Corner of the frame** — `"place": "top-left" | "top-right" | "bottom-left" | "bottom-right"`.
  Use this for legend, title, source credit, scale bar, and north arrow.
- **A place on the map** — `"geoAnchor": [longitude, latitude]`. Use this for pins and callouts:
  the annotation stays on that location.

Do not write raw `position` values: they are screen pixels and depend on the user's window.

| `kind` | Fields | |
| --- | --- | --- |
| `titleblock` | `title`, `subtitle`, `width` | headline for the map |
| `legend` | `dataStyleLink: { "layerId": "<layer id>" }`, optional `title`, `width` | entries are generated from that layer's `dataStyle` |
| `sourcecredit` | `text`, `width` | data source and caveats. Always include one. |
| `scalebar` | `unitSystem`: `metric` or `imperial` | |
| `northarrow` | `size` | only useful if the map is rotated |
| `text` | `text`, `width` | free text; usually with `geoAnchor` |
| `pin` | `label`, `size` | a marker; needs `geoAnchor` |

A legend needs its layer to have an `id` and a `dataStyle`. One legend per styled layer.
Any annotation accepts `style` overrides such as `{ "textSize": 14, "textColor": "#111827" }`.
A legend is drawn as a white card; change it with `style.fillColor` / `style.strokeColor`.

## Checklist before handing over

- `node scripts/validate.mjs your.cartoproj` prints `OK`.
- Every styled layer has a legend; the map has a title and a source credit.
- The mapped number is a rate where it should be, and its unit appears in the legend title or a label suffix.
- You told the user what is estimated or simplified.
