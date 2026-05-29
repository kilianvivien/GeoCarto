# import

Vector data import, normalized to the canonical `GeoJsonLayer` document model.

- `geojson.ts` — GeoJSON parsing + the shared `featureCollectionToLayer` builder.
- `formats.ts` — format detection by extension and per-format parsers
  (TopoJSON, KML, GPX, zipped Shapefile). Each heavyweight parser
  (`topojson-client`, `@tmcw/togeojson`, `shpjs`) is **lazy-loaded** via dynamic
  `import()` so it stays out of the initial bundle.
- `importLayers.ts` — the `importDataFiles` orchestrator (drop / picker entry
  points) and toast reporting.

Shapefile bundles (`.zip` of `.shp/.dbf/.shx/.prj`) are reprojected to WGS84 by
`shpjs` using the embedded `.prj`. Parsing currently runs on the main thread;
moving the heavy parsers into a worker is a follow-up (see PHASE2 §M14).
