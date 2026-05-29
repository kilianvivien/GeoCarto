# export

Renders the project document to downloadable artwork. Every exporter is
lazy-loaded from the Export dialog so its heavy deps stay out of the initial
bundle.

- `raster.ts` — PNG / JPEG from an offscreen MapLibre render composited with the
  Konva annotation layer. Exposes `renderBasemapCanvas` for reuse.
- `renderAnnotations.ts` — imperative Konva renderer used by raster export.
- `svg.ts` — SVG serializer (M15). Basemap + imported data embed as a raster
  `<image>`; annotations / text / furniture become editable vector objects.
  Effects (hatch, halo, blend) and detailed pin glyphs are flattened.
- `pdf.ts` — raster-in-PDF via `jsPDF` (M15). One page sized to the frame;
  editable-vector PDF is deferred to Post-v1.

Coordinates: SVG mirrors raster's container→frame scale and projects geo
annotations through the live map, so SVG matches the PNG by construction.
