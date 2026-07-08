# GeoCarto — Implementation Plan: Five Key New Features

This plan proposes and details the five features that would most improve GeoCarto
for its target users (journalists, teachers, designers, casual map makers), chosen
to close the most visible gaps in the current product. It complements
[plan.md](plan.md) — where a feature overlaps an existing milestone (M28/M29,
M31, M32, M35), this document is the concrete implementation design for it.

## Gap analysis — why these five

The current app (0.3.0) has a complete editorial loop: basemap → import →
annotate → export. The gaps that remain are the ones users hit first:

| # | Gap today | Feature that closes it |
| --- | --- | --- |
| 1 | No way to find a place — users must pan/zoom manually to frame a map | **Place search & geocoding** |
| 2 | Layer styling is flat (one fill/stroke per layer, manual per-feature overrides only); no data-driven maps | **Thematic mapping: choropleth & proportional symbols** |
| 3 | Web Mercator only — the #1 item in the README "Known gaps" for editorial world maps | **Editorial projections (Equal Earth, Robinson, Winkel Tripel)** |
| 4 | PDF export is a flattened raster; data layers rasterize inside SVG; three duplicated renderers drift | **Unified scene graph → print-grade vector export** |
| 5 | Output is static images only; journalists need embeds and shareable maps | **Interactive HTML export** |

Cross-cutting constraints that every feature below respects:

- **`.cartoproj` is the source of truth.** Each feature extends the schema in
  `src/project/cartoproj.ts` and adds versioned defaulting in
  `src/project/serialize.ts` so old documents open cleanly.
- **Web/desktop parity.** Anything needing network or filesystem access goes
  through `src/app/platform.ts` (`isTauri()`), like the existing basemap fetch.
- **Undo/redo.** Document mutations run through `useDocumentStore` and label
  themselves via `hintHistoryLabel(...)` so they coalesce properly.
- **i18n.** All new strings land in both English and French catalogs in
  `src/i18n/locales.ts`; the catalog-completeness unit test enforces this.
- **Bundle budget.** Heavy new dependencies (d3-geo, svg2pdf) are lazy-loaded
  chunks, mirroring how import parsers are already split; `npm run bundle-budget`
  must stay green.

Suggested build order: **1 → 2 → 4 → 3 → 5**. Feature 1 is small and
high-impact; 2 needs no new architecture; 4 (scene graph) is the prerequisite
investment for both print export and feature 5's overlay rendering; 3 is the
most isolated and can proceed in parallel after 2.

---

## Feature 1 — Place search & geocoding

### Motivation

Every mapping session starts with "frame the map on X". Today the only way is
manual pan/zoom. A search box that flies to a place — and optionally drops a
pin — removes the single biggest friction point for casual users and speeds up
every editorial workflow. It is also table stakes: every comparable tool
(Datawrapper, Felt, Google My Maps) has it.

### UX

- A search field in the title bar (collapsed to a magnifier icon, expands on
  click or `⌘K → "Go to place…"`), plus a `Go to place…` command in the
  existing command palette (`src/ui/CommandPalette.tsx` / `src/app/appCommands.ts`).
- Debounced-as-you-type results dropdown: place name, type badge (city, country,
  street…), country. Keyboard navigable (↑/↓/Enter/Escape), matching the
  command-palette interaction model.
- Selecting a result flies the map to the place (`flyTo` with a zoom level
  derived from the result's bounding box).
- Secondary action on each result ("Add pin"): drops a `pin` annotation
  (existing `AnnotationKind`) at the location, pre-labelled with the place name
  — one undoable step.
- Direct coordinate entry: input matching `lat, lon` (or `lon, lat` with a
  disambiguation hint) bypasses the geocoder and jumps straight there.
- Works in map-setup mode (framing) and editing mode (screen pan/zoom rules
  already handled by `viewTransformStore`).

### Architecture

- **Provider:** Photon (komoot) as the default geocoder — free, no API key,
  liberal usage policy, good multilingual results, and it returns GeoJSON.
  Nominatim as a documented alternative. The provider is abstracted behind a
  tiny interface so a paid provider can be added later:

  ```ts
  // src/geocode/provider.ts
  export interface GeocodeResult {
    id: string;
    label: string;          // display name
    kind: string;           // city | country | street | poi | …
    center: [number, number];
    bbox?: [number, number, number, number];
  }
  export interface GeocodeProvider {
    search(query: string, opts: { lang: string; limit: number; signal: AbortSignal }): Promise<GeocodeResult[]>;
  }
  ```

- **New domain folder** `src/geocode/` with `provider.ts`, `photon.ts`,
  `parseCoordinates.ts`, and `useGeocode.ts` (debounce 300 ms, abort in-flight
  requests, cache last N queries in memory).
- **Desktop:** route the fetch through the same `plugin-http` path used for
  basemap fetches in Tauri (WKWebView CORS resilience) via a `fetchJson()`
  helper on `src/app/platform.ts`.
- **Network policy:** this is the first user-triggered third-party request
  besides tiles. Add attribution ("Search by Photon/OpenStreetMap") in the
  dropdown footer, and a Settings toggle (General tab) to disable online search
  entirely — when disabled, only coordinate entry works. No document schema
  change is needed (search is app-level, not project state).

### Implementation steps

1. `src/geocode/` module: provider interface, Photon adapter, coordinate
   parser (unit-tested against `48.85, 2.35`, `2.35, 48.85`, DMS strings later).
2. `useGeocode` hook: debounce, abort, error state (offline → inline "search
   unavailable" hint, never a toast storm).
3. `PlaceSearch.tsx` in `src/ui/`: input + results popover, reusing glass
   styles and `useModalFocusTrap` conventions; wire into `TitleBar.tsx`.
4. Add `goToPlace` command in `appCommands.ts` so it appears in the command
   palette and gets a shortcut (`⌘⇧F` proposed, checked against
   `KeyboardShortcuts.tsx`).
5. "Add pin" path: reuse `annotationFactory.ts` pin creation with geographic
   anchoring; label from result; single history step.
6. Settings toggle + i18n strings (EN/FR) + attribution footer.
7. Tests: Vitest for parser/provider (mock fetch), Playwright flow: type
   "Paris" → select → map recenters (assert viewport store), coordinate entry,
   pin drop.

**Estimate:** ~1 week. **Risks:** provider rate limits (mitigate: debounce,
limit 8 results, single-flight); result quality varies by locale (send the
active app locale as `lang`).

---

## Feature 2 — Thematic mapping: choropleth & proportional symbols

### Motivation

This is the core "make a map that says something" gap (planned as M31). Today a
GeoJSON layer has one fill/stroke, and per-feature colors must be set by hand
(`featureFillColors` keyed by `@id` in `GeoJsonStyle`). Journalists and teachers
need "color regions by this column" and "size points by this column" — the two
map types that account for most editorial output. Manual per-feature painting
does not scale past a dozen features.

### UX

- In the layer's Style panel, a new **"Style by data"** section with a mode
  switch: `Single style` (today) / `Color by value (choropleth)` /
  `Size by value (proportional symbols)`.
- **Choropleth flow:** pick attribute (dropdown of numeric/string properties,
  scanned from the layer's `FeatureCollection` with type inference and a value
  histogram preview) → classification (quantile, equal interval, natural
  breaks/Jenks, manual break editing) → class count (3–9) → color ramp
  (curated sequential/diverging/categorical palettes, ColorBrewer-derived,
  colorblind-safe badge) → optional "reverse ramp", missing-value color.
- **Proportional symbols flow (point layers):** pick numeric attribute → min/max
  radius → square-root or linear scaling → optional fixed color or a ramp.
- Live preview on the map as parameters change (one coalesced history step per
  committed change, using the existing drag-coalescing pattern).
- **Legend integration:** the legend builder (`src/style/legendSwatches.ts`)
  gains an "auto from data style" mode — class swatches + formatted ranges
  (locale-aware number formatting already exists) that update when the ramp or
  breaks change, with the existing manual-override escape hatch.

### Data model

Extend `GeoJsonStyle` in `src/project/cartoproj.ts` (additive, defaulted in
`serialize.ts` so version 1 documents load unchanged):

```ts
export type ClassificationMethod = 'quantile' | 'equal' | 'jenks' | 'manual';

export interface ChoroplethStyle {
  kind: 'choropleth';
  attribute: string;
  method: ClassificationMethod;
  classCount: number;          // 3..9
  breaks: number[];            // materialized breaks (recomputed unless method === 'manual')
  paletteId: string;           // curated ramp id
  reverse: boolean;
  missingColor: string;
}

export interface ProportionalStyle {
  kind: 'proportional';
  attribute: string;
  minRadius: number;
  maxRadius: number;
  scale: 'sqrt' | 'linear';
  color: string;
}

export interface GeoJsonStyle {
  // ...existing fields...
  dataStyle?: ChoroplethStyle | ProportionalStyle; // absent = single style (today)
}
```

Breaks are **materialized into the document** (not recomputed at render) so a
saved project renders identically even if classification code changes later;
they are recomputed only when the user edits attribute/method/count or the
layer's data is edited (hook into the existing vector-edit commit path).

### Rendering

- `src/canvas/GeoJsonLayers.tsx` / `syncLayers.ts`: when `dataStyle` is
  present, emit MapLibre data-driven expressions instead of flat paint:
  - Choropleth fill: `['step', ['to-number', ['get', attribute]], c0, b1, c1, …]`
    with the missing color handled via a `['case', valid, step, missingColor]`
    wrapper.
  - Proportional radius: `['interpolate', ['linear'], ['sqrt', ['get', attr]], …]`
    (or plain linear), on the existing circle layer.
- **Export parity:** raster/SVG export already renders data through the live
  MapLibre canvas, so choropleths export correctly for free. The deck.gl
  heatmap strategy is orthogonal (`renderStrategy` stays independent of
  `dataStyle`; UI disables "Style by data" while heatmap is active).
- New pure module `src/style/classify.ts`: attribute scan (numeric coercion,
  null/missing detection), quantile/equal/Jenks implementations (Jenks
  hand-rolled or via the tiny `simple-statistics` function — decide by bundle
  cost), palette catalog `src/style/ramps.ts`. All heavily unit-tested — this
  is the correctness core.

### Implementation steps

1. `classify.ts` + `ramps.ts` with unit tests (golden tests for breaks on known
   distributions; missing/NaN handling; single-value degenerate case).
2. Schema extension + `serialize.ts` defaulting + round-trip tests.
3. Expression builders in `syncLayers.ts` + unit tests asserting generated
   expressions.
4. Style panel UI (`src/ui/StylePanel.tsx`): mode switch, attribute picker with
   histogram sparkline, ramp picker; wire mutations through `documentStore`
   with history labels.
5. Legend auto-linking in `legendSwatches.ts` + legend annotation refresh.
6. Recompute-on-data-edit hook in the vector-edit commit path.
7. Playwright: import demo GeoJSON → apply choropleth → assert per-class
   feature colors via query + legend content; export visual-diff baseline.

**Estimate:** ~2–3 weeks. **Risks:** Jenks performance on 10k+ features
(sample above a threshold); mixed-type attribute columns (coerce + report %
unmappable in the UI); legend/manual-override interaction (auto mode is
read-only until the user explicitly detaches — same pattern as today's linked
swatches).

---

## Feature 3 — Editorial projections (Equal Earth, Robinson, Winkel Tripel, Bonne)

### Motivation

The README's first "known gap". World and continental editorial maps in
Mercator are visually wrong (Greenland problem) and editorially dated; Equal
Earth/Robinson are the expected look for print and news graphics. This is
milestone M32; the plan already points at the right approach — a parallel
d3-geo render path — because MapLibre cannot reproject raster/vector tile
basemaps into arbitrary projections.

### Product shape (the honest constraint)

Non-Mercator projections make the interactive tile basemap unavailable. Rather
than pretending otherwise, the feature is a distinct **"Projected map"**
document mode chosen in map setup:

- Basemap sources for a projected map: **empty canvas**, built-in world/continent
  vector outlines (bundled Natural Earth 110m/50m land + countries as static
  GeoJSON assets, lazy-loaded), or the user's imported layers themselves.
- Everything else works normally: GeoJSON layers render projected, annotations
  with `map` anchoring project through the same function, canvas-anchored
  furniture is untouched, exports work at full fidelity (vector data even
  benefits: no tile raster involved).
- A **graticule** object (new furniture kind) with configurable interval and
  styling — essential for the editorial look.
- Projection picker: Equal Earth, Robinson, Winkel Tripel, Bonne, Natural
  Earth I (all in `d3-geo` / `d3-geo-projection`), plus center longitude
  (lambda rotation) and standard-parallel controls where applicable.
- Pan/zoom: d3-geo projections support `rotate`/`scale`/`translate`; wire
  drag-to-rotate-lambda and wheel-to-scale so the projected canvas still feels
  interactive, but frame it as "compose a projection", not slippy-map browsing.

### Architecture

- **Schema:** extend the document with

  ```ts
  export type MapEngine = 'mercator' | 'projected';
  export interface ProjectionConfig {
    id: 'equal-earth' | 'robinson' | 'winkel3' | 'bonne' | 'natural-earth-1';
    rotateLambda: number;      // center longitude
    parallel?: number;         // Bonne standard parallel
    scale: number;             // d3 projection scale
    center: [number, number];  // translate offset in frame coords
  }
  ```

  `engine: 'mercator'` is the default written by `serialize.ts` for all
  existing documents.

- **Render path:** a new `src/canvas/ProjectedMapView.tsx` sibling of
  `MapView.tsx` — a Canvas2D (or SVG) renderer driven by `d3-geo`'s
  `geoPath`. `MapCanvas.tsx` mounts one or the other from `engine`. The Konva
  annotation stage stays; the only contract it needs is the coordinate bridge.
- **Coordinate bridge:** today `canvasCoordinates.ts` maps lngLat ↔ screen via
  the MapLibre camera. Introduce a minimal projection interface both engines
  implement:

  ```ts
  export interface CanvasProjection {
    project(lngLat: [number, number]): { x: number; y: number } | null; // null = clipped
    unproject(point: { x: number; y: number }): [number, number] | null;
  }
  ```

  Annotation anchoring, pin placement, measurement, terra-draw gating (vector
  editing on projected maps is deferred to a fast-follow; edit mode is disabled
  with an explanatory tooltip in v1), and export all consume this interface
  instead of the map instance directly. **This refactor is the bulk of the
  work and should land first as a no-op change on the Mercator path.**
- **Export:** raster export draws the projected canvas directly (it is already
  a Canvas2D surface); SVG export can emit true vector paths from `geoPath` —
  projected maps leapfrog Mercator maps in SVG fidelity, which is a selling
  point.
- **Dependencies:** `d3-geo` + `d3-geo-projection` (lazy chunk, loaded only
  when a projected document opens), Natural Earth GeoJSON assets (~1–2 MB,
  fetched/lazy like basemap assets, cached).

### Implementation steps

1. `CanvasProjection` interface + refactor Mercator consumers onto it (no
   behavior change; full regression run).
2. Schema + serialize defaulting (`engine`, `projection`).
3. `src/projection/` module wrapping d3-geo: construct projection from config,
   graticule generator, fit-to-frame helper. Unit tests on known coordinates.
4. `ProjectedMapView` Canvas2D renderer: land/countries assets, GeoJSON layers
   via `geoPath` (respecting existing `GeoJsonStyle` and Feature 2's
   `dataStyle`), clipping, redraw on config change.
5. Map-setup UI: engine choice + projection picker with live thumbnails;
   rotate/scale interactions.
6. Graticule furniture kind + inspector controls.
7. Exports: raster path, vector SVG path; export visual-diff baselines.
8. Playwright: create projected doc → import world GeoJSON → annotate → export.

**Estimate:** ~3–4 weeks (≈1 week of it is the coordinate-bridge refactor).
**Risks:** performance of Canvas2D redraw with large layers (mitigate:
render-on-idle + cached offscreen bitmap during drags); scope creep toward
"tiles in Equal Earth" (explicitly out of scope, documented in UI copy);
annotation types that assume screen-north (north arrow hidden/disabled on
projected maps where bearing is meaningless).

---

## Feature 4 — Unified scene graph → print-grade vector export (editable-vector PDF)

### Motivation

Three renderers currently duplicate every annotation and furniture kind: the
Konva stage (`src/canvas/AnnotationStage.tsx`, ~2,400 lines), the raster
exporter (`src/export/renderAnnotations.ts`, ~850 lines), and the SVG exporter
(`src/export/svg.ts`). Every new style feature must be implemented three times
and drifts (the visual-diff harness exists precisely because of this). And the
flagship export gap — **PDF is a flattened raster** — can't be fixed without a
single vector-faithful description of the scene. This is M28+M29 and is the
prerequisite investment for Feature 5's overlay output too.

### Design

Introduce a render IR: a pure function from document state to a display list.

```ts
// src/render/spec.ts — no Konva, DOM, or MapLibre imports allowed (enforced by lint rule)
export type RenderNode =
  | { kind: 'path'; d: PathCommand[]; fill?: Paint; stroke?: StrokeStyle; effects?: Effects }
  | { kind: 'text'; runs: TextRun[]; box: Box; halo?: Halo; effects?: Effects }
  | { kind: 'image'; href: ImageRef; box: Box; effects?: Effects }
  | { kind: 'group'; transform: Mat2D; opacity: number; blend: BlendMode; clip?: PathCommand[]; children: RenderNode[] };

export function buildScene(doc: CartoProject, proj: CanvasProjection, frame: Frame): RenderNode[];
```

`buildScene` encodes all the per-kind geometry that is currently triplicated:
scale-bar tick math, north-arrow shape, legend layout, pin glyphs, hatch
patterns, arrowheads, measurement labels. Backends become thin interpreters:

1. **Canvas2D backend** → replaces `renderAnnotations.ts` (raster export).
2. **SVG backend** → replaces the annotation/furniture half of `svg.ts`.
3. **PDF backend** → new. Pragmatic route: generate the SVG backend's output
   and convert with `svg2pdf.js` (same maintainers as jsPDF, real vector
   output, font support via jsPDF's font registry). Direct jsPDF path calls
   are the fallback if svg2pdf fidelity disappoints for a node kind.
4. **Konva stage** is *not* migrated in v1 (interactive editing has different
   needs); instead the visual-diff harness compares the Konva screenshot
   against the Canvas2D backend on a fixture document covering every
   annotation kind and effect, turning drift into a red test instead of a
   user-visible export bug.

**PDF composition:** map raster (existing pipeline) as the base image sized to
the composition frame at the chosen DPI; annotations/furniture as vector
content above it; text as real text (embedded TTF subset — bundle the UI's
fonts for embedding; fall back to outlines for fonts that can't be embedded).
Data layers stay raster in v1 (matching SVG today); with Feature 3, projected
maps can export data as vector paths through the same scene graph later.

**Export UI:** `ExportDialog.tsx`'s existing fidelity matrix gets a "Vector
PDF" row; a quality selector (raster PDF = today's path, kept as fallback;
vector PDF = new default). Page presets (`pagePresets.ts`) unchanged.

### Implementation steps

1. Define `spec.ts` types + `buildScene` for the three simplest kinds (rect,
   ellipse, line/arrow) + Canvas2D backend; wire the visual-diff fixture and
   assert pixel-parity with the current raster exporter for those kinds.
2. Port remaining kinds one by one (text+halo, polygon+hatch, pin, image,
   measurement, legend, title block, source credit, scale bar, north arrow),
   each with a fixture entry. Delete the corresponding `renderAnnotations.ts`
   code as each lands — the migration is incremental and always shippable.
3. SVG backend + swap `svg.ts` annotation emission onto it (existing SVG unit
   tests act as the safety net; update snapshots deliberately).
4. PDF backend via svg2pdf (lazy chunk with jsPDF); font embedding; export
   dialog wiring; e2e that opens the produced PDF and asserts vector content
   (parse with `pdf-lib` in the test to count path/text objects — no visual
   flakiness).
5. Effects audit: blend modes and drop shadows differ per target (PDF blend
   support is limited) — document per-format degradation in the fidelity
   matrix rather than silently approximating.

**Estimate:** ~3–4 weeks, cleanly incremental. **Risks:** text metrics parity
between Konva and the backends (measure via the same canvas `measureText`
source); svg2pdf gaps for patterns/blends (fallback: rasterize just the
offending node into the PDF, still keeping everything else vector); bundle
growth (all PDF machinery already lazy — keep svg2pdf in that chunk).

---

## Feature 5 — Interactive HTML export

### Motivation

GeoCarto's output today ends at static images. The target users increasingly
publish online: a journalist wants an embeddable interactive map with tooltips;
a teacher wants a link students can pan around. This is M35's first bullet and
the highest-leverage "reach" feature — it turns every GeoCarto project into a
publishable artifact without any cloud infrastructure (a single self-contained
`.html` file works on any static host or CMS embed).

### Product shape

- New "Interactive HTML" format in the export dialog with options:
  - **Interaction:** pan/zoom on/off (off = fixed frame, still with tooltips),
    initial view locked to the composition frame, optional min/max zoom.
  - **Tooltips:** per GeoJSON layer, choose the properties to show (default:
    the label heuristic already used by `labelForFeature`).
  - **Attribution & title:** injected from the document's title block / source
    credit if present.
- Output: **one self-contained `.html` file** — MapLibre GL JS inlined (no CDN,
  so it works offline and never breaks; adds ~250 KB gzipped), style JSON
  inlined, GeoJSON layers inlined, annotations/furniture inlined as SVG.
  Tile data is *not* bundled: built-in basemaps reference the hosted Protomaps
  PMTiles endpoint (same one the app uses); `static-image` and local-PMTiles
  basemaps export with the image embedded / a clear "online basemap required"
  notice respectively. File-size estimate shown before export.

### Architecture

- `src/export/html.ts` (lazy chunk) assembles the file from:
  1. A **runtime template** (`src/export/html-runtime/`): a small TS module,
     compiled by Vite as a separate library entry at build time and inlined as
     a string asset. It boots MapLibre, applies the style, adds GeoJSON
     sources/layers, binds tooltip handlers, and enforces the interaction
     options. Keeping it a real compiled module (not string-concatenated JS)
     makes it testable and type-safe.
  2. **Style + layers:** reuse `basemapStyle.ts` output and the same
     data-driven expressions from Feature 2 — choropleths and proportional
     symbols are interactive for free.
  3. **Annotations/furniture overlay:** the Feature 4 SVG backend renders the
     scene once; map-anchored nodes are wrapped in a MapLibre custom layer /
     `map.on('move')`-synced overlay that re-transforms the SVG group (the
     runtime includes the same `CanvasProjection` math), while canvas-anchored
     furniture is absolutely positioned. v1 keeps map-anchored annotations
     visually correct during pan/zoom by transforming as a group; per-node
     reflow (e.g. scale bar re-snapping) is a fast-follow.
- **Security/embed hygiene:** escape all user strings into the template;
  no external requests except tiles; document the recommended
  `<iframe sandbox>` embed snippet in the export success toast.
- **Tests:** unit tests on the assembler (well-formed HTML, all layers
  present, options respected); Playwright test that opens the exported file
  from disk, pans, and asserts a tooltip appears — this doubles as the
  regression net for the runtime.

### Implementation steps

1. Vite config: second build entry for `html-runtime` (IIFE, no code-splitting),
   emitted as an asset the app imports as `?raw`.
2. Assembler `html.ts`: style/layer serialization, options plumbing, size
   estimate; export dialog UI + fidelity-matrix row.
3. Runtime: map boot, GeoJSON layers + expressions, tooltips, interaction
   locks.
4. Overlay: SVG scene from Feature 4's backend + move-synced group transform.
5. Basemap-kind handling matrix (builtin / style-url / pmtiles-url /
   static-image / empty) with per-kind notices.
6. i18n, Playwright coverage, bundle-budget check (runtime asset is export-time
   payload, not app-load payload — budget the app chunk only).

**Estimate:** ~2–3 weeks after Feature 4's SVG backend exists (a reduced v1
without the annotation overlay could ship standalone in ~1.5 weeks).
**Risks:** MapLibre version drift between app and runtime (pin identical
version — single dependency, guaranteed); large embedded GeoJSON (warn above a
threshold, offer simplification later); annotation overlay fidelity during
zoom (group transform is exact for geographic anchors at the export latitude
band; documented limitation for extreme zoom-out).

---

## Sequencing, dependencies, and milestone mapping

```
Feature 1  Place search            (1 wk)   independent            → new milestone
Feature 2  Thematic mapping        (2–3 wk) independent            → M31 (partial: joins/buffers stay later)
Feature 4  Scene graph + vector PDF(3–4 wk) independent            → M28 + M29 (first half)
Feature 3  Editorial projections   (3–4 wk) after its bridge refactor → M32
Feature 5  Interactive HTML        (2–3 wk) needs F4's SVG backend → M35 (first bullet)
```

- The **coordinate-bridge refactor** (Feature 3, step 1) and the **scene graph**
  (Feature 4) are the two structural investments; both also unblock later
  roadmap items (vector data in SVG for M25, pro vector editing on projected
  maps, plugin-facing render API for M35).
- Features 1 and 2 are the quick user-visible wins and should ship first.
- Every feature lands behind the existing pattern of phase-gated tools where
  UI must not activate early, and each updates: the export fidelity matrix
  (where relevant), EN/FR catalogs, the README feature list, and
  `docs/plan.md` milestone status.

## Acceptance summary

| Feature | Done means |
| --- | --- |
| Place search | Type a place, land on it, optionally get a labelled pin; works web + desktop; disable toggle in Settings; EN/FR. |
| Thematic mapping | Choropleth + proportional symbols from any attribute; materialized breaks round-trip through `.cartoproj`; auto legend; correct in all exports. |
| Projections | New projected-document mode with ≥4 editorial projections, graticule, Natural Earth outlines; annotations anchor correctly; raster + vector-SVG export. |
| Vector export | PDF contains selectable text and vector paths for every annotation/furniture kind; raster PDF remains as fallback; visual-diff parity fixture green. |
| Interactive HTML | Single self-contained file with pan/zoom + tooltips + annotations; opens offline (hosted tiles excepted); documented embed snippet. |
