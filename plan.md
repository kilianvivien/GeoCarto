# GeoCarto — Implementation Progress

Tracks delivery against `docs-mocks/PRD.md` and `docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md`.
Status legend: ✅ done · 🟡 in progress · ⬜ not started.

GeoCarto is a "Figma for maps" — an open-canvas cartography editor that runs in
the browser (Phase 1) and as a native macOS app (v1). Three delivery phases:
**Phase 1 / MVP**, **Phase 2 / v1 Editorial**, and **Post-v1 Roadmap**.

---

## Phase 1 / MVP — browser-based core loop

Goal: open a basemap, import GeoJSON, annotate, save/reopen a project, and export
a high-DPI raster from a fixed composition frame.

### Milestone 1 — Project Foundation ✅

- ✅ Vite + React 19 + TypeScript (strict)
- ✅ Tailwind v4, Lucide icons
- ✅ MapLibre, PMTiles, Konva/react-konva, Zustand, Immer installed
- ✅ Vitest + Playwright configured
- ✅ PRD-mirrored `src/` folders; lint / typecheck / test scripts
- Note: shadcn baseline deferred — the design system is custom liquid-glass.

### Milestone 2 — Map Canvas and Basemap ✅

- ✅ `MapView` with MapLibre init and viewport state sync
- ✅ PMTiles protocol registered once at app root
- ✅ Default editorial basemap (remote Protomaps demo PMTiles, light/dark flavors)
- ✅ Pan/zoom, zoom + coordinate display, attribution, export frame overlay
- ✅ macOS liquid-glass app shell; light/dark theme with basemap restyle

### Milestone 3 — Document Model and Layers ✅

- ✅ `.cartoproj` schema (metadata, viewport, export frame, layers, styles)
- ✅ Document store: add, rename, reorder, lock, hide, delete, select
- ✅ GeoJSON import (file picker + drag-drop) with toast feedback
- ✅ Render imported GeoJSON as MapLibre sources/layers
- ✅ Layer panel + attribute inspector
- Note: annotation objects join the `.cartoproj` schema in Milestone 4.

### Milestone 4 — Annotation Tools ⬜

- ⬜ Konva annotation stage, camera-synced to MapView
- ⬜ Selection/move tool with Figma-style transformer handles
- ⬜ Text, rectangle, ellipse, line/arrow, polygon, point pin tools
- ⬜ Inspector controls: fill, stroke, opacity, text size/color, pin color/icon
- ⬜ Font choice from a small bundled set
- ⬜ Object lock/hide; geo vs canvas anchoring ("Pin to map" / "Pin to canvas")
- ⬜ Keyboard shortcuts (V/M/H/K/P/R/O/G/T/B/I/A…), delete selected

### Milestone 5 — Save, Autosave, and Export ⬜

- ⬜ Save/open plain `.cartoproj` JSON
- ⬜ Browser autosave every 10s + recovery prompt for autosaved drafts
- ⬜ PNG/JPEG export from the export frame at 1x / 2x / custom scale
- ⬜ White or transparent background; JPEG quality slider
- ⬜ Basemap + GeoJSON + annotations composited into the raster export

### Milestone 6 — Verification and Stabilization ⬜

- ⬜ Playwright flows: first run, import, annotation, round-trip, autosave, export
- ⬜ Unit tests: schema migration/defaulting, layer ordering, annotation updates
- ⬜ Reference + medium performance datasets
- ⬜ Performance measurement (cold start, pan/zoom, import, export, memory)
- ⬜ Fix usability blockers

---

## Phase 2 / v1 Editorial — production-grade editorial tool

### Basemap sources & styling ⬜

The basemap must be **user-selectable**, from either an online source or a custom
base — this is a core editorial requirement.

- ⬜ Built-in style presets: Editorial Light, Editorial Dark, Minimal Grey, Print B&W
- ⬜ **Basemap source picker** — choose the active basemap:
  - ⬜ Online: hosted Protomaps PMTiles / standard tile or style URLs
  - ⬜ Custom: user-supplied MapLibre **style JSON import**
  - ⬜ Custom: user-supplied PMTiles archive (URL or local file)
  - ⬜ Offline: bundled / downloaded regional basemap packs (desktop)
- ⬜ Toggle basemap sub-layers: roads, labels, water, landuse, buildings, boundaries
- ⬜ Persist the chosen basemap source + style in the `.cartoproj` document

### Richer annotation & styling ⬜

- ⬜ deck.gl data layers interleaved via `MapboxOverlay`
- ⬜ Dashed lines, arrowheads, halos, shadows, patterns, blend modes
- ⬜ Grouped objects; smart guides (edge/center) and pixel/grid snap
- ⬜ Title block, source credit, scale bar, north arrow
- ⬜ Manually editable legend builder
- ⬜ Undo/redo with ≥100 meaningful document steps

### Import & export ⬜

- ⬜ Import TopoJSON, KML, GPX, Shapefile
- ⬜ SVG export — technical spike first, then editable vector serializer
      (supported objects stay editable in Illustrator/Figma; fallbacks documented)

### Desktop (macOS) ⬜

- ⬜ Tauri 2 shell; signed + notarized macOS build
- ⬜ Native file open/save dialogs and drag-drop import
- ⬜ Offline regional basemap packs with a first-run download/bundle choice

---

## Post-v1 Roadmap (rough priority order) ⬜

- ⬜ Interactive HTML export (self-contained, pan/zoom/tooltips)
- ⬜ GIS-leaning features: attribute joins, choropleth class wizard,
      proportional symbols, dot density, simple buffering
- ⬜ Non-Mercator editorial projections (Robinson, Equal Earth, Winkel Tripel,
      Bonne…) via a parallel d3-geo / d3-geo-projection pipeline
- ⬜ GeoPackage import
- ⬜ PDF export from the SVG/export scene graph; later CMYK + ICC for print houses
- ⬜ Templates gallery for editorial and classroom outputs
- ⬜ Cloud project sync, share links, real-time collaboration (Yjs CRDT)
- ⬜ Windows and Linux desktop builds
- ⬜ Plugin / extension API

---

## Cross-cutting concerns

### Export contract (PRD §5.4)

| Format | Phase | Status |
|---|---|---|
| PNG  | Phase 1   | ⬜ Milestone 5 |
| JPEG | Phase 1   | ⬜ Milestone 5 |
| SVG  | v1 (after spike) | ⬜ |
| PDF  | Post-v1   | ⬜ |
| Interactive HTML | Post-v1 | ⬜ |

### Performance targets (PRD §7)

- ⬜ Web cold start < 2s to interactive (cached)
- ⬜ 60 fps pan/zoom with demo basemap + 10k features + 200 annotations
- ⬜ 60 fps dragging 25 selected annotations
- ⬜ 10 MB GeoJSON parse + render < 3s
- ⬜ PNG export 4000×3000 @2x < 5s
- ⬜ v1 desktop: < 1.5s cold start, 60 fps at editorial scale, < 700 MB resident

### Platform delivery (PRD §5.5)

- 🟡 Phase 1 web — Vite SPA, static-hosting ready (in progress)
- ⬜ v1 desktop macOS — Tauri 2, signed + notarized
- ⬜ Roadmap — Windows + Linux

### Architecture invariants (PRD §3–4)

- The `.cartoproj` document is the single source of truth; MapLibre, deck.gl,
  Konva, and export are renderers/projections of it — never independent state.
- Annotation editing lives on a Konva stage above the MapLibre canvas, camera-
  synced to the map's view state.
- Dual anchoring (`geoAnchor` / `screenAnchor` / `hybridAnchor`) is exposed per
  annotation in the inspector.

### Open questions (PRD §10)

Brand pass on the name, free vs paid model, minimum macOS/WebKit version,
desktop basemap-pack strategy, bundled vs user fonts, SVG fidelity bar, and
whether comments stay roadmap-only — to decide within the first sprints.
