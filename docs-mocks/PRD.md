# PRD — GeoCarto

A sleek, visual-first cartography app that runs in the browser and as a native MacOS app, built around an open-canvas editing metaphor. Editorial and casual users first; GIS-style power features added later as a roadmap extension.

---

## 1. Context

**Why this project.** Existing mapping tools fall into two camps that both miss the mark for non-specialists who still want beautiful maps:

- **GIS tools** (QGIS, ArcGIS) — extremely powerful, but the learning curve is brutal and the output looks technical. Wrong for editorial/casual use.
- **Online editorial tools** (Datawrapper, Felt, Khartis, Magrit) — easy, but each is constrained: Datawrapper is chart-shaped; Felt is collaboration-shaped; Khartis is thematic-only; Magrit is research-shaped. None of them give the "open canvas, drop anything anywhere, design freely" feel of a Figma or tldraw.

**Outcome.** A single-window app where a user opens a map (from OSM or an imported vector file), then annotates, paints, labels and styles it on an infinite canvas using direct manipulation — and exports a print-ready PNG, SVG or PDF. The metaphor is "Figma for maps", not "QGIS-lite".

**Target users (priority order)**
1. Editorial / journalistic map makers who today fall back to Illustrator
2. Casual users — teachers, marketers, hobbyists, students
3. Light GIS use cases (roadmap, not v1 focus)

**Non-goals (v1)**
- Real-time multi-user collaboration
- Server-side rendering / hosted map sharing
- Advanced spatial analysis (buffers, joins, geocoding pipelines)
- Plugin / extension API

**Delivery phases**
1. **Phase 1 / MVP** — prove the core editing loop: open a basemap, import GeoJSON, add simple annotations, save/reopen a project, export a high-DPI PNG.
2. **Phase 2 / v1 editorial** — add richer styling, legends, SVG export, desktop offline packaging, and the first signed MacOS build.
3. **Post-v1** — advanced GIS styling, non-Mercator editorial projections, collaborative/cloud features, print-house PDF workflows, and more platforms.

---

## 2. Product principles

1. **Visual first, panels second.** Direct manipulation on the canvas is the primary interaction. Tool panes are for choosing tools and tuning parameters of what's already on the canvas — not for building the map blind.
2. **One window, no modes.** Everything lives in a single workspace. No "switch to analysis mode / switch to design mode" splits.
3. **Sensible defaults beat configuration.** A new map should look good before the user touches a single style control. Style presets bias toward editorial aesthetics.
4. **Vector as a product promise, not an assumption.** Keep the document model vector-first, but treat SVG/PDF fidelity as a feature with explicit acceptance tests. Raster export is acceptable for Phase 1; editable vector export is a v1 requirement only after a technical spike proves the pipeline.
5. **GPU performance is non-negotiable.** Pan, zoom, and drag-to-move annotations stay at 60 fps at editorial scale (≤100k vector features, a few thousand annotation objects). Drops in fps are bugs.
6. **Offline behavior is explicit.** Phase 1 works after the app and demo assets are loaded. v1 desktop works offline with a bundled or user-downloaded regional basemap pack; web offline is cache-limited and not equivalent to desktop.

---

## 3. Recommended technical stack

| Concern | Choice | Rationale |
|---|---|---|
| Language / framework | **TypeScript + React 19 + Vite** | Standard, fast HMR, huge ecosystem for canvas/UI libs |
| Desktop wrapper | **Tauri 2** | Small native shell with MacOS-first packaging. Uses WKWebView on MacOS, so Safari/WebKit compatibility and minimum supported MacOS version must be tested directly. |
| Basemap renderer | **MapLibre GL JS v5+** | WebGL vector tiles, MIT-licensed Mapbox GL JS fork, mature, no API key lock-in. Treat Mercator/globe as the interactive v1 baseline; editorial projections use a separate roadmap pipeline. |
| Basemap data | **Protomaps PMTiles** (OSM-derived) | Single-file basemap archive, no tile server required, HTTP Range-friendly. Desktop v1 uses regional packs; web fetches from a static CDN. |
| Data layers (heatmaps, choropleths, dot density) | **deck.gl** (interleaved with MapLibre via `MapboxOverlay`) | GPU-accelerated, designed exactly for this overlay pattern, same WebGL2 context as MapLibre |
| Vector projections (roadmap) | **d3-geo + d3-geo-projection** | For editorial Robinson / Equal Earth / Winkel Tripel etc.; rendered as a parallel SVG/Canvas export/view pipeline, not as a MapLibre style toggle |
| Annotation / open-canvas layer | **Custom React layer over a Konva.js stage** | Konva gives us the Figma-like transformer handles, hit-testing, snapping; React for the inspector. Sits *on top* of the MapLibre canvas, coordinates synced to the map's viewState |
| Drawing tools (polygons, lines, points on the map) | **terra-draw** | MapLibre-compatible, modern, framework-agnostic, supports all geometry types; preferred over the legacy mapbox-gl-draw |
| State management | **Zustand** + **Immer** | Small, no-boilerplate; document state is a single normalized tree |
| Persistence (project file) | **Custom `.cartoproj` JSON bundle**, optionally zipped with embedded assets | Human-readable, diff-able, future-proof; can carry an embedded PMTiles or GeoJSON inside the zip for offline portability |
| Vector import | **Phase 1: GeoJSON. v1: TopoJSON, KML, GPX, Shapefile. Roadmap: GeoPackage.** | Start with the editorial happy path, then add heavier parsers once the layer model is stable. |
| Raster export | `canvas.toBlob` on a high-DPI offscreen canvas | Standard, free |
| SVG export | **Technical spike first**, then custom document serializer + MapLibre source/style extraction where feasible | Key editorial promise. Must preserve editable groups for supported objects and clearly mark any rasterized fallback. |
| PDF export | **Roadmap after SVG**, likely `pdf-lib` plus SVG/path conversion or a dedicated SVG-to-PDF renderer | PDF should reuse the SVG/export scene graph; do not build a separate export truth. |
| UI components | **shadcn/ui** (Radix + Tailwind) | Sleek, polished defaults; the "casual users" answer was explicit about wanting a sleek tool |
| Icons | **Lucide** | Goes with shadcn |
| Testing | **Vitest** + **Playwright** | Unit + canvas smoke tests |

**The single non-obvious architectural choice** is the annotation layer being a separate Konva stage rather than living inside MapLibre. Reason: MapLibre's symbol layer is fast but rigid — it is optimized for tiled rendering of repeated symbols, not for free editorial composition with rotate/skew/multi-select/grouping. Konva gives us a Figma-style edit surface; the app keeps its camera locked to MapLibre's view state and stores every editable object in the canonical project document so export never depends on scraping pixels from the live canvas.

---

## 4. Architecture overview

```
┌──────────────────── Window (Tauri shell OR browser tab) ────────────────────┐
│  ┌─ Top bar ──────────────────────────────────────────────────────────────┐ │
│  │  File · Edit · View · Project name · Export · Account (web only)      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌─ Left rail ─┐ ┌─── Canvas viewport ───────────────────┐ ┌─ Right pane ─┐ │
│  │ Tool select │ │                                       │ │  Inspector   │ │
│  │  Move       │ │   [ MapLibre WebGL canvas ]           │ │  (selection  │ │
│  │  Pan        │ │   [ deck.gl interleaved layers ]      │ │   context-   │ │
│  │  Marquee    │ │   [ Konva annotation stage ]          │ │   aware)     │ │
│  │  Pen/poly   │ │   [ HTML overlay for labels/legend ]  │ │              │ │
│  │  Rect       │ │                                       │ │  Layers      │ │
│  │  Text       │ │                                       │ │  panel       │ │
│  │  Paint area │ │                                       │ │              │ │
│  │  Point pin  │ │                                       │ │  Style       │ │
│  │  Arrow      │ │                                       │ │  presets     │ │
│  │  Legend     │ └───────────────────────────────────────┘ └──────────────┘ │
│  │  Comment    │ ┌─ Bottom bar (collapsed by default) ────────────────────┐ │
│  └─────────────┘ │ Zoom · Coords · Scale bar · Projection · Notifications │ │
│                  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Render pipeline (per frame)**

1. MapLibre updates basemap tiles + drawn map features (WebGL2)
2. `MapboxOverlay` interleaves deck.gl data layers into the same WebGL context
3. Konva annotation stage re-syncs its camera from MapLibre `map.getCenter() / getZoom() / getBearing() / getPitch()` and re-positions geo-anchored shapes; screen-anchored shapes (legend, scale bar) stay put
4. HTML overlay layer (labels with full typography) is positioned by projecting geo → screen each frame

**Document and coordinate model.** The project file is the source of truth; MapLibre, deck.gl, Konva, and HTML overlays are renderers of that model.

- **Map layers** store source metadata, style settings, layer order, visibility, locks, and attribution.
- **Geo objects** store GeoJSON geometry plus style and transforms. They move with the map and export as projected paths where supported.
- **Canvas objects** store screen-space bounds and transforms. They stay fixed to the composition frame: title blocks, credits, legends, north arrows, and layout shapes.
- **Hybrid objects** store both a geographic anchor and screen/layout settings: point labels, callouts, scale bars, and labels pinned to map features.

Every annotation exposes an anchoring control in the inspector:
- `geoAnchor: [lng, lat]` or GeoJSON geometry — moves with the map
- `screenAnchor: { x, y, edge }` — sticks to the export frame or viewport
- `hybridAnchor` — follows a map feature while preserving local label/callout offsets

This dual anchoring is core to the editorial workflow and must be exposed in the inspector ("Pin to map" / "Pin to canvas" toggle).

---

## 5. Feature set

### 5.1 Phase 1 / MVP

Goal: prove the core loop with the smallest credible product.

- Open a default MapLibre + PMTiles basemap with one clean editorial style.
- Import GeoJSON as editable map layers, including basic attribute inspection.
- Show a layer panel with layer order, visibility, locking, and delete.
- Select, pan, zoom, and move around the map smoothly.
- Add simple annotations: text, rectangle/ellipse, line/arrow, polygon, and point pin.
- Edit basic styles: fill, stroke, opacity, text size, text color, font choice from a small bundled set, and pin color/icon.
- Save and reopen a `.cartoproj` JSON file.
- Autosave a recoverable local draft for the current browser session.
- Export high-DPI PNG and JPEG from a defined export frame.

### 5.2 v1 Editorial Release

Goal: make the app useful for editorial map production.

- Add built-in style presets: Editorial Light, Editorial Dark, Minimal Grey, Print B&W.
- Toggle basemap sub-layers: roads, labels, water, landuse, buildings, boundaries.
- Import TopoJSON, KML, GPX, and Shapefile.
- Add richer styling: dashed lines, arrowheads, halos, shadows, patterns, blend modes, and grouped objects.
- Add title block, source credit, scale bar, north arrow, and a manually editable legend builder.
- Add keyboard shortcuts and undo/redo with at least 100 meaningful document steps.
- Add smart guides for object edges/centers and a pixel/grid snap.
- Add custom MapLibre style JSON import.
- Add signed and notarized MacOS desktop build with native file open/save dialogs and drag-drop import.
- Add offline desktop regional basemap packs, with a clear first-run download/bundle choice.
- Add SVG export after the export spike proves acceptable fidelity. Supported objects remain editable in Illustrator/Figma; unsupported effects are clearly rasterized or excluded.

### 5.3 Post-v1 Roadmap Features

- Interactive HTML export with pan/zoom/tooltips.
- GIS-leaning features: attribute joins, choropleth class wizard, proportional symbols, dot density, and simple buffering.
- Non-Mercator editorial projections via d3-geo and d3-geo-projection.
- GeoPackage import once heavier binary parsing is justified.
- PDF export with embedded fonts, print sizes, and later CMYK/ICC support.
- Templates gallery for common editorial and classroom outputs.
- Cloud project sync, share links, and real-time collaboration.
- Windows and Linux desktop builds.
- Plugin or extension API.

### 5.4 Export Contract

| Format | Phase | Notes |
|---|---|---|
| PNG | Phase 1 | High-DPI 1x/2x/custom, white or transparent background, fixed export frame |
| JPEG | Phase 1 | Quality slider, white background |
| SVG | v1 after spike | Editable vector for supported layers and annotations; layer groups preserved; unsupported effects documented |
| PDF | Post-v1 | Built from the SVG/export scene graph, not a separate renderer |
| Interactive HTML | Post-v1 | Self-contained bundle with pan/zoom/tooltips |

**SVG export spike acceptance**
- Export a basemap region, one imported GeoJSON layer, text, shape, line, pin, legend, and source credit.
- Open the SVG in a browser and Illustrator/Figma and confirm supported objects remain editable.
- Compare SVG render against the canvas with a visual diff.
- Document unsupported effects and choose either a raster fallback or a roadmap deferral.

### 5.5 Platform delivery

- **Phase 1 web**: Vite-built SPA, local development first, static hosting-ready. Basemap PMTiles may be fetched from a static CDN or loaded from a small local dev sample.
- **v1 desktop MacOS**: Tauri 2 wrapper, signed and notarized. Native file open/save dialogs, drag-drop files, and a documented offline basemap-pack strategy.
- **Roadmap platforms**: Windows and Linux after the MacOS/WebKit path is stable.

---

## 6. Roadmap (post-v1, in rough order)

1. Interactive HTML export.
2. GIS-leaning features: attribute joins on imported data, choropleth class wizard, proportional symbols, simple buffering.
3. Non-Mercator editorial projections: Robinson, Equal Earth, Winkel Tripel, Bonne, etc. via d3-geo pipeline.
4. PDF export, then CMYK PDF + ICC profiles for print houses.
5. Templates gallery.
6. Cloud project sync + share links, requiring a backend.
7. Tauri Windows + Linux builds.
8. Real-time multi-user collaboration, likely Yjs CRDT.

---

## 7. Performance targets

| Scenario | Target |
|---|---|
| Phase 1 cold start (web, cached) | < 2 s to interactive on reference machine |
| Phase 1 pan/zoom with demo basemap + 10k GeoJSON features + 200 annotations | sustained 60 fps |
| Phase 1 drag-move 25 selected annotations | sustained 60 fps |
| Phase 1 open a 10 MB GeoJSON | < 3 s parse + render |
| Phase 1 PNG export 4000×3000 @2× | < 5 s |
| v1 cold start (desktop) | < 1.5 s to interactive on reference Mac |
| v1 pan/zoom at editorial scale (100k features, 2k annotations) | sustained 60 fps |
| v1 memory ceiling (desktop) | < 700 MB resident at editorial scale |

These are tested on fixed reference datasets. Phase 1 targets are CI-friendly; v1 targets require a dedicated MacOS/WebKit reference run.

---

## 8. Critical files & modules (initial repo layout)

```
/src
  /app                   App shell, routing, Tauri bridge
  /canvas
    MapView.tsx          MapLibre instance + viewport state
    DeckOverlay.tsx      deck.gl interleaved layers
    AnnotationStage.tsx  Konva stage, camera-synced to MapView
    HtmlOverlay.tsx      DOM overlay for rich text labels
    coordinates.ts       geo<->screen projection helpers
    exportFrame.ts       fixed export area and viewport math
  /tools                 One module per tool (pen, text, paint, ...)
  /layers                Layer model, ordering, visibility, locking
  /style                 Built-in presets, style editor
  /import                Phase 1 GeoJSON parser; additional v1 parsers later
  /export
    png.ts
    jpeg.ts
    svg-spike.ts         v1 export spike, not Phase 1 production code
    svg.ts               v1 vector serializer after spike approval
    pdf.ts               post-v1 PDF pipeline
  /project               .cartoproj schema, load/save, autosave
  /state                 Zustand stores (document, selection, viewport, ui)
  /ui                    shadcn components, panels, inspector
  /basemap               Protomaps integration, style presets
/src-tauri               Tauri 2 Rust shell
/public                  Sample PMTiles for dev
```

---

## 9. Verification & acceptance

End-to-end tests for Phase 1 acceptance:

1. **First-run flow** — open the app, see the default basemap, draw a polygon, fill it red, add text, export PNG. No menu-diving required.
2. **Import scenario** — import a GeoJSON of French départements, inspect attributes, style fill/stroke, add a title/source credit, export PNG.
3. **Project round-trip** — save a `.cartoproj`, close the app, reopen the file, confirm layers, annotations, viewport, and styles are identical.
4. **Autosave recovery** — edit a map, simulate reload/crash, confirm a recoverable draft is offered.
5. **Performance scenario** — open the Phase 1 reference project, pan/zoom for 30 seconds, and verify the target frame rate.
6. **Export fidelity** — export PNG/JPEG and visually compare to the export frame at 100% zoom; pixel diff PNG within tolerance.

v1 acceptance adds SVG fidelity, desktop offline, signed MacOS packaging, and larger performance datasets. Phase 1 tests run in Playwright against the web build; desktop tests are added when the Tauri shell enters scope.

---

## 10. Open questions for follow-up sessions

(Not blockers to start v1, but worth deciding within the first sprint.)

- Naming. "GeoCarto" is the current name; want a quick brand pass before public repo.
- Free vs paid model — implications for web hosting and PMTiles bandwidth.
- Minimum supported MacOS/WebKit version for the desktop build.
- Whether v1 desktop bundles a regional PMTiles pack, asks the user to download one on first launch, or ships only a small starter region.
- Built-in fonts — license what ships with the app vs. allowing user-supplied fonts.
- Exact SVG export fidelity bar — which effects must remain editable, and which may rasterize.
- Whether comments should remain roadmap-only until collaboration or review workflows exist.

---

## Sources

- [MapLibre GL JS documentation](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre Style Spec — projection](https://maplibre.org/maplibre-style-spec/projection/)
- [MapLibre plugins — maplibre-gl-export, Terra Draw, PMTiles](https://maplibre.org/maplibre-gl-js/docs/plugins/)
- [Protomaps documentation](https://docs.protomaps.com/)
- [Protomaps PMTiles for MapLibre](https://docs.protomaps.com/pmtiles/maplibre)
- [deck.gl MapboxOverlay](https://deck.gl/docs/api-reference/mapbox/mapbox-overlay)
- [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/)
- [Konva Transformer documentation](https://konvajs.org/docs/select_and_transform/Basic_demo.html)
- [pdf-lib PDFPage drawSvgPath API](https://pdf-lib.js.org/docs/api/classes/pdfpage)
- [Terra Draw OSGeo project page](https://www.osgeo.org/projects/terra-draw/)
- [Khartis — Sciences Po thematic mapping](https://www.sciencespo.fr/cartographie/khartis/en/)
- [Datawrapper — maps for journalism](https://www.datawrapper.de/)
- [Felt — free mapping tools roundup](https://felt.com/blog/free-mapping-tools)
