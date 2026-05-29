# GeoCarto — Implementation Progress

Tracks delivery against `docs-mocks/PRD.md` and `docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md`.
Status legend: ✅ done · 🟡 in progress · ⬜ not started.

GeoCarto is a "Figma for maps" — an open-canvas cartography editor that runs in
the browser (Phase 1) and as a native macOS app (v1). Three delivery phases:
**Phase 1 / MVP exit hardening**, **Phase 2 / v1 Editorial**, and
**Post-v1 Roadmap**.

---

## Phase 1 / MVP — browser core loop ✅ Exit complete

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
- ✅ Required basemap setup flow: choose source, frame map, lock map before editing

### Milestone 3 — Document Model and Layers ✅

- ✅ `.cartoproj` schema (metadata, viewport, export frame, layers, styles)
- ✅ Document store: add, rename, reorder, lock, hide, delete, select
- ✅ GeoJSON import (file picker + drag-drop) with toast feedback
- ✅ Render imported GeoJSON as MapLibre sources/layers
- ✅ Layer panel + attribute inspector
- Note: annotation objects join the `.cartoproj` schema in Milestone 4.

### Milestone 4 — Annotation Tools ✅

- ✅ Konva annotation stage, camera-synced to MapView
- ✅ Selection/move tool with Figma-style transformer handles
- ✅ Text, rectangle, ellipse, line/arrow, polygon, point pin tools
- ✅ Inspector controls: fill, stroke, opacity, text size/color, pin color/icon
- ✅ Font choice from a small bundled set
- ✅ Object lock/hide; geo vs canvas anchoring ("Pin to map" / "Pin to canvas")
- ✅ Phase 1 tool gate locked by a vitest invariant: any Phase 2-flagged tool
      must stay disabled until its owning Phase 2 milestone lands.
- ✅ Keyboard shortcuts gated by `isToolEnabled`; Phase 2 shortcuts no-op.
- Note: annotations are serializable in `.cartoproj`; save/autosave/export lands in Milestone 5.

### Milestone 5 — Save, Autosave, and Export ✅

- ✅ Save/open plain `.cartoproj` JSON (File System Access API + download/upload fallback)
- ✅ Browser autosave every 10s (IndexedDB), now keyed per session, with a
      multi-draft recovery prompt that restores each tab independently (M8).
- ✅ PNG/JPEG export from the export frame at 1x / 2x / custom scale
- ✅ White or transparent background; JPEG quality slider
- ✅ Basemap + GeoJSON + annotations composited into the raster export
- ✅ New/Close prompts before discarding dirty work; Open now lands the file in
      a fresh tab instead of replacing the active session.
- 🟡 Local PMTiles file basemaps remain disabled in Phase 1 web (`blob:` URLs
      can't survive save/reopen). Revisited in Milestone 11.
- 🟡 Static PDF basemap export deferred to the SVG/PDF pipeline in Milestone 15.

### Milestone 6 — Verification and Stabilization ✅

- ✅ Playwright flows: first run, import, annotation, round-trip, autosave, export
- ✅ Unit tests: schema migration/defaulting, layer ordering, annotation
      updates, session registry, undo/redo round-trip.
- ✅ Export visual-diff harness compares the PNG against a committed baseline
      with a `maxDiffPixelRatio` tolerance; a seeded 8 px pin shift breaks the
      baseline as proof the harness catches drift.
- ✅ Performance smoke imports the deterministic 10 MB `large.geojson` fixture
      (regenerable via `npm run fixtures:large`) and enforces PRD §7 cold
      start, import, export, and heap thresholds with CI headroom.
- ✅ MapLibre, Konva, PMTiles, and the raster exporter are each in their own
      Rollup chunk; `npm run bundle-budget` fails CI on regression.

---

## Phase 1 Exit Audit & Hardening ✅

Closed out by Milestone 7. Phase 2 work now sits on a clean Phase 1 base.

- ✅ Phase 2 toolbar controls remain inert; the Snap, Share, Ruler, Marquee,
      Paint, Image, Legend, and Comment buttons keep their disabled state and
      a vitest invariant fails if anyone flips one on without shipping its
      milestone. Undo/Redo are no longer Phase 2 placeholders — see M9.
- ✅ GeoJSON layer style controls in the inspector, persisted in `.cartoproj`.
- ✅ Locked layers can't be renamed, deleted, reordered, or restyled.
- ✅ Dirty-document guards on New, Open, Close, and Autosave Restore.
- ✅ Local PMTiles file selection blocked in Phase 1 web.
- ✅ Export visual/pixel diff harness against the visible composition frame
      (`tests/e2e/export-visual-diff.spec.ts`).
- ✅ Performance acceptance uses the 10 MB `large.geojson` fixture and enforces
      cold start, import, export, and memory thresholds with CI headroom.
- ✅ MapLibre/Konva/PMTiles/raster export each ship in their own chunk; the
      `bundle-budget` script gates regressions.

---

## Phase 2 / v1 Editorial — production-grade editorial tool

### Project & Document Workflow 🟡

- ✅ Multi-project sessions/tabs (M8):
  - ✅ `ProjectSession { id, autosaveKey, lastActiveAt, snapshot }` and
        `activeSessionId` in `useSessionsStore`; doc store stays the active-tab
        view so Phase 1 consumers are unchanged.
  - ✅ Tab bar with New, Close, drag-to-reorder, and per-tab dirty indicator.
  - ✅ New opens a fresh blank tab; Open lands the file in a new tab; Close
        prompts on unsaved changes; ⌘W closes the active tab.
  - ✅ Autosave is keyed per session; the recovery prompt restores every dirty
        session (each into its own tab), not just the most recent.
- ✅ Recent projects menu (M8). Stores File System Access handles where the
      browser supplies them so reopening is one click; Safari/Firefox get a
      filename-only history with a graceful "use Open" toast.
- ✅ Undo/redo with ≥100 meaningful document steps (M9):
  - Structural-share-friendly snapshot history capped at 100 entries.
  - `hintHistoryLabel(label)` + 400 ms coalesce window collapses drag bursts
    into one entry. Selection / viewport / tool state stays out of history by
    construction (they live in separate stores).
  - ⌘Z / ⌘⇧Z, plus toolbar Undo/Redo lifted from the Phase 1 gate.
- ✅ Editorial canvas aids (M10):
  - Locked-canvas pan/zoom via the screen-only `viewTransformStore` (H tool);
    composition pan never mutates project geometry.
  - Marquee select with shift/cmd/alt modifiers across all annotations.
  - Ruler tool (K) → persisted `measurement` annotation type with metric /
    imperial distance + area readouts driven from `geoPoints`.
  - Grid snap (toggle + spacing in the status bar) with on-canvas grid overlay.
  - Smart guides — edge/center alignment cues during drag with ±6 px tolerance.
  - Object grouping via ⌘G / ⌘⇧G and the canvas context menu; groups
    round-trip through `.cartoproj`.
- ✅ Image placement, legend builder, and local comment pins (M13/M14).
      Cloud share links remain Post-v1.

### Basemap sources & styling 🟡

The basemap must be **user-selectable**, from either an online source or a custom
base — this is a core editorial requirement.

- ✅ Built-in style presets: Editorial Light, Editorial Dark, Minimal Grey, Print B&W
- ✅ **Basemap source picker** (M11):
  - ✅ Online: hosted Protomaps PMTiles / standard tile or style URLs
  - ✅ Custom: user-supplied MapLibre style URL
  - 🟡 Custom: PMTiles URL supported; local PMTiles file deferred because
        persisted `blob:` URLs break save/reopen
  - ⬜ Offline: bundled / downloaded regional basemap packs (desktop, M16)
- ✅ Basemap sub-layer toggles (M11): roads, labels, water, landuse, buildings,
      boundaries. Filter applied at style-build time by Protomaps
      `source-layer`; persisted per project; chips in MapSetupPanel + status-bar
      popover for editing mode. `style-url`/`static` basemaps hide the chips.
- ✅ Persist the chosen basemap source + sub-layer mask in `.cartoproj`
      (with a defaulting migration for Phase 1 documents).

### Richer annotation & styling 🟡

- ✅ deck.gl data layers interleaved via `MapboxOverlay` (M12). A layer's
      "Render" control (Vector / Heatmap) in the inspector switches it to a
      deck.gl HeatmapLayer drawn interleaved with the basemap; the same overlay
      is attached to the offscreen export map so heatmaps appear in raster/PDF.
      deck.gl is lazy-loaded only when a heatmap layer exists; the bundle budget
      was raised from 3 MB → 3.7 MB with a documented rationale (lazy chunks).
- ✅ Dashed lines, arrowheads, hatch / pattern fills.
- ✅ Halos, drop shadows, and blend modes (normal / multiply / screen /
      overlay) on every annotation kind, surfaced via the Inspector's
      progressively-disclosed Effects panel and mirrored in PNG/JPEG export
      (M12).
- ✅ Grouped objects; smart guides (edge/center) and pixel/grid snap (M10).
- ✅ Title block, source credit, scale bar, north arrow (M13) — screen-anchored
      furniture inserted from a single Insert menu. Scale bar snaps to a round
      distance and tracks map scale; north arrow follows map bearing. Both
      mirror correctly into raster export.
- ✅ Manually editable legend builder with linked/overridden swatches (M13)

### Import & export 🟡

- ✅ Import TopoJSON, KML, GPX, Shapefile (M14). Format detected by extension;
      each parser (`topojson-client`, `@tmcw/togeojson`, `shpjs`) is lazy-loaded
      so it stays out of the initial bundle. Shapefile zips are reprojected to
      WGS84 from the embedded `.prj`. Drop + picker accept all formats.
- ✅ Image placement (M14) — drop/insert PNG/JPEG/SVG raster, geo or screen
      anchored, embedded as base64 in `.cartoproj`.
- ✅ SVG export (M15) — basemap + imported data embed as a raster `<image>`;
      annotations, text, and map furniture serialize as editable vector objects.
      Effects (hatch fills, halos, blend modes) and detailed pin glyphs are
      flattened, surfaced in the export dialog. Verified well-formed and within
      a rasterized-vs-PNG diff tolerance (~1.2%). Illustrator/Figma editability
      is unverified in-app (no Illustrator available in this environment).
- ✅ PDF export (M15 bonus) — raster-in-PDF via jsPDF, one page sized to the
      composition frame. Editable-vector PDF stays Post-v1.
- 🟡 Move heavy importers onto a worker thread (parsers are pure and
      worker-ready; deferred follow-up).
- 🟡 GeoJSON-as-editable-vector-paths in SVG (currently embedded in the basemap
      raster); a future refinement.

### Desktop (macOS) ⬜

- ⬜ Tauri 2 shell; signed + no notarization yet
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
| PNG  | Phase 1   | ✅ Milestone 5 |
| JPEG | Phase 1   | 🟡 Milestone 5; broader acceptance coverage added |
| SVG  | v1 (after spike) | ✅ Milestone 15 (basemap raster + vector annotations) |
| PDF  | Post-v1   | ✅ Milestone 15 (raster-in-PDF; vector PDF stays Post-v1) |
| Interactive HTML | Post-v1 | ⬜ |

### Performance targets (PRD §7)

- ⬜ Web cold start < 2s to interactive (cached)
- ⬜ 60 fps pan/zoom with demo basemap + 10k features + 200 annotations
- ⬜ 60 fps dragging 25 selected annotations
- ⬜ 10 MB GeoJSON parse + render < 3s
- ⬜ PNG export 4000×3000 @2x < 5s
- ⬜ v1 desktop: < 1.5s cold start, 60 fps at editorial scale, < 700 MB resident

### Platform delivery (PRD §5.5)

- ✅ Phase 1 web — Vite SPA, static-hosting ready
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
