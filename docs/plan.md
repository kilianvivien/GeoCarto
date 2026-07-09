# GeoCarto — Implementation Plan

Tracks delivery against [PRD.md](PRD.md), the archived Phase 1/2 plans, and the
active [PHASE3_IMPLEMENTATION_PLAN.md](PHASE3_IMPLEMENTATION_PLAN.md).

Status legend: ✅ done · 🟡 in progress · ⬜ not started · ➡️ moved to a later phase.

## Current Stage

GeoCarto is no longer in the Phase 1 browser-MVP stage. As of `0.2.2`, the app is
best described as **Phase 3 closeout / stabilization**:

- ✅ Browser MVP is complete: basemap setup, GeoJSON import, annotations,
  `.cartoproj` save/reopen/autosave, and high-DPI raster export.
- ✅ Editorial v1 is mostly complete: multi-tab projects, undo/redo, canvas aids,
  richer annotation styling, map furniture, legend builder, broad import support,
  SVG export, and raster-in-PDF export.
- ✅ Core editable-data work is complete: imported GeoJSON can be edited, drawn,
  deleted, inspected, and exported back to GeoJSON.
- ✅ macOS desktop shell exists via Tauri 2, with native open/save/export dialogs.
- 🟡 The remaining near-term work is not another MVP pass; it is closeout work:
  desktop file-drop/local-basemap gaps, import/export technical debt, CI/coverage,
  and performance acceptance around the now-larger editor.

The milestone order below reflects that reality: finish the current product surface
and safety rails before adding deeper GIS, print-production, or collaboration scope.
Web and macOS desktop remain co-equal targets: desktop capabilities can be additive,
but every shipped feature should preserve user-facing parity unless a milestone
explicitly says otherwise.

---

## Shipped Foundation ✅

### M1 — Project Foundation ✅

- ✅ Vite 7 + React 19 + TypeScript strict mode.
- ✅ Tailwind v4, Lucide icons, custom liquid-glass UI layer.
- ✅ MapLibre GL, PMTiles, Konva/react-konva, Zustand, Immer.
- ✅ Vitest + Playwright.
- ✅ PRD-aligned `src/` domains and `@/` alias.
- Note: shadcn remains configured in the project, but the active UI system is custom.

### M2 — Map Canvas and Basemap ✅

- ✅ MapLibre `MapView` with viewport state sync.
- ✅ PMTiles protocol registration.
- ✅ Built-in Protomaps editorial basemaps: light, dark, minimal grey, print B&W.
- ✅ Basemap setup flow: choose source, frame map, lock map before editing.
- ✅ Pan/zoom, zoom and coordinate display, attribution, export-frame overlay.
- ✅ Light/dark app shell with basemap restyling.

### M3 — Document Model and Layers ✅

- ✅ `.cartoproj` schema for metadata, viewport, export frame, basemap, layers,
  annotations, styles, and map furniture.
- ✅ Layer operations: add, rename, reorder, lock, hide, delete, select.
- ✅ GeoJSON import via file picker and drag-drop in the web app.
- ✅ Imported data renders as MapLibre layers; heatmaps render through deck.gl.
- ✅ Layer panel, attribute inspector, and editable layer styling.

### M4 — Annotation Tools ✅

- ✅ Konva annotation stage synced to the map camera.
- ✅ Select/move with transformer handles.
- ✅ Text, rectangle, ellipse, line/arrow, polygon, pin, measurement, image,
  comment, title block, source credit, scale bar, north arrow, and legend objects.
- ✅ Fill, stroke, opacity, font, halo, shadow, blend mode, hatch/pattern, pin
  color/icon, and anchoring controls.
- ✅ Object lock/hide, grouping/ungrouping, grid snap, smart guides, marquee select.
- ✅ Phase-gated tool invariant prevents future controls from becoming active
  without their owning milestone.

### M5 — Project Workflow and Export ✅

- ✅ Save/open plain `.cartoproj` JSON through File System Access API with
  download/upload fallback.
- ✅ Per-session browser autosave with multi-draft recovery.
- ✅ Multi-project tab bar, dirty guards, recent projects, and close/new/open flows.
- ✅ Undo/redo with 100 meaningful document steps and drag coalescing.
- ✅ PNG/JPEG export from the composition frame at 1x, 2x, or custom scale.
- ✅ SVG export with annotations/furniture as vector objects and map/data as raster.
- ✅ Raster-in-PDF export sized to the composition frame.

### M6 — Verification and Stabilization ✅

- ✅ Playwright coverage for first run, import, annotations, project round-trip,
  autosave, sessions/history, layer management, vector editing, and export.
- ✅ Unit coverage for stores, serialization/defaulting, imports/exports, i18n,
  preferences, annotation transforms, error boundary, and tooltip behavior.
- ✅ Export visual-diff harness against a committed PNG baseline.
- ✅ 10 MB GeoJSON fixture and performance smoke test.
- ✅ Bundle-budget script with explicit MapLibre/Konva/PMTiles/export chunking.

---

## Shipped Editorial v1 ✅

### M7 — Phase 1 Exit Hardening ✅

- ✅ Locked layers cannot be renamed, deleted, reordered, or restyled.
- ✅ Dirty-document guards cover New, Open, Close, and Autosave Restore.
- ✅ Local PMTiles file selection blocked in web where `blob:` URLs cannot survive
  save/reopen.
- ✅ Phase 2 placeholder controls are inert until their owning milestone ships.

### M8 — Multi-Project Sessions ✅

- ✅ `ProjectSession` registry with active-session projection into the document store.
- ✅ New/Open create tabs; Close prompts on unsaved work; tabs can be reordered.
- ✅ Autosave and recovery are keyed per session.
- ✅ Recent projects menu stores file handles where the browser supports them.

### M9 — History ✅

- ✅ Structural-share-friendly document snapshots capped at 100 entries.
- ✅ `hintHistoryLabel(label)` and coalescing for drag/edit bursts.
- ✅ Selection, viewport, and active tool state stay outside document history.
- ✅ Keyboard and toolbar undo/redo enabled.

### M10 — Editorial Canvas Aids ✅

- ✅ Screen-only pan/zoom for locked composition work.
- ✅ Marquee select with modifier behavior.
- ✅ Measurement/ruler annotations with locale-aware units.
- ✅ Grid snap, smart guides, and grouped-object editing.

### M11 — Basemap Sources and Sublayers ✅

- ✅ Built-in style presets.
- ✅ Hosted PMTiles, standard tile/style URLs, custom MapLibre style URLs,
  custom PMTiles URLs, static image/PDF basemaps, and empty canvas.
- ✅ Protomaps sublayer toggles persisted per project.
- ➡️ Local PMTiles files move to desktop closeout because web persistence needs
  a native path rather than a `blob:` URL.
- ➡️ Offline regional packs move to desktop closeout.

### M12 — Rich Data and Effects ✅

- ✅ deck.gl heatmap strategy for imported GeoJSON layers, including export path.
- ✅ Dashed lines, arrowheads, hatch/pattern fills.
- ✅ Halos, drop shadows, and blend modes mirrored in raster export.

### M13 — Map Furniture and Legend ✅

- ✅ Title block, source credit, scale bar, north arrow.
- ✅ Manual legend builder with linked or overridden swatches.
- ✅ Screen-anchored furniture inserts from a single Insert menu.

### M14 — Import Reach ✅

- ✅ TopoJSON, KML, GPX, and Shapefile import.
- ✅ Heavy parsers are lazy-loaded.
- ✅ Shapefile zips reproject from embedded `.prj` when available.
- ✅ Image placement for PNG/JPEG/SVG raster.
- ➡️ Worker-thread parsing moves to current closeout.

### M15 — SVG and PDF Export ✅

- ✅ SVG export is well-formed and preserves editable vector annotations/furniture.
- ✅ Imported data is currently baked into the exported map raster.
- ✅ PDF export is raster-in-PDF.
- ➡️ GeoJSON-as-vector SVG and editable-vector PDF move to later milestones.

---

## Shipped Phase 3 Capabilities ✅

### M16 — Tauri Desktop Shell ✅

- ✅ Tauri 2 macOS shell with web-feature parity behind `isTauri()`.
- ✅ Native file open/save dialogs through `plugin-dialog` and `plugin-fs`.
- ✅ Native export save dialog.
- ✅ Built-in basemap fetch through `plugin-http` for WKWebView CORS resilience.
- ✅ Native window chrome, vibrancy, app menu, and macOS shortcuts.
- ✅ Cross-platform Tauri config overlays are scaffolded for future Windows/Linux.
- ⬜ App is not signed or notarized.

### M17 — GeoJSON Vector Editing ✅

- ✅ `terra-draw` + MapLibre adapter wired as a controlled editor.
- ✅ Layer `FeatureCollection` remains the canonical source of truth.
- ✅ Per-layer edit mode for unlocked GeoJSON layers.
- ✅ Move vertices, insert midpoints, drag whole features, rotate/scale selections.
- ✅ Draw point, line, polygon, rectangle, and circle features.
- ✅ Delete features and recompute feature metadata.
- ✅ Geometry edits integrate with existing undo/redo.

### M18 — Editable Attributes and Data Export ✅

- ✅ Add, rename, delete, and edit feature properties from the Properties pane.
- ✅ Layer locks are respected by geometry and attribute editing.
- ✅ Editable data round-trips through `.cartoproj`.
- ✅ Per-layer GeoJSON export and export-all GeoJSON.
- ✅ Raster/SVG/PDF export includes edited data through the existing render path.

### M19 — Localization ✅

- ✅ Typed English and French message catalogs.
- ✅ Catalog-backed strings across the main app surface.
- ✅ Browser auto-detection plus Settings override.
- ✅ Locale-aware number formatting.
- ✅ Tauri menu rebuilds in the active app locale.

### M20 — Discoverability ✅

- ✅ Reusable glass tooltip component with focus/hover behavior and shortcut chips.
- ✅ Tool rail, vector-edit toolbar, title-bar actions, and Export tooltips.
- ✅ Disabled controls retain tooltip affordances.
- 🟡 Status-bar toggles, inspector controls, and export options still have some
  native `title=` usage.

### M21 — Settings ✅

- ✅ Settings modal with Appearance, Units, Canvas defaults, Autosave, Basemap,
  and reset-to-defaults.
- ✅ Versioned preferences store in `localStorage`.
- ✅ Preferences are wired to actual behavior: autosave interval, unit defaults,
  basemap defaults, launch-time canvas defaults, and accent tokens.

### M22 — Crash Recovery ✅

- ✅ Top-level React error boundary.
- ✅ Active session is force-flushed to autosave before reload is offered.
- ✅ Crash-loop guard can discard a poison project instead of restoring forever.

---

## Current Closeout Track 🟡

This is the active near-term sequence. It is intentionally ordered around release
confidence and desktop/data reliability before deeper feature work.

### M23 — Quality Gates and Coverage 🟡

- ✅ Add CI workflow for lint, typecheck, unit tests, Playwright, and
  `bundle-budget`.
- ✅ Add coverage reporting and pragmatic floors for document/store/export core.
- ✅ Add unit tests for i18n catalog completeness.
- 🟡 Add Playwright flows for locale switching, settings persistence, and remaining
  tooltip coverage.
- 🟡 Add accessibility/keyboard closeout: Settings focus trap, Escape-to-close,
  tab `aria-controls`, and keyboard-only coverage for modal and toolbar flows.
- ⬜ Replace remaining native `title=` affordances with the glass tooltip system.
- ✅ Add a command palette / shortcut reference powered by the existing
  `AppCommand` model so web chrome, keyboard shortcuts, and native menu commands
  stay discoverable from one place.
- ⬜ Keep bundle-budget green after worker/import and desktop changes.

### M24 — Desktop File and Basemap Reliability 🟡

- ✅ Fix desktop drag-drop import. Current issue: Tauri intercepts OS drops through
  `tauri://drag-drop`, while the web handler expects `dataTransfer.files`.
- ✅ Support local PMTiles file basemaps on desktop through the native FS path.
- ✅ Persist local PMTiles basemap references as absolute native paths for now.
  Portability/relinking can come later; current priority is reliable save/reopen
  on the same machine.
- ✅ Validate missing/stale local basemap paths on open and show a clear recovery
  state instead of silently falling back or failing the map.
- ⬜ Tighten/review Tauri filesystem capability scope once local basemap paths and
  offline cache locations are settled.
- ✅ Keep desktop and web feature parity explicit: any desktop-only path must have
  a web fallback, and any web-only feature should either work in Tauri or be
  listed as a known gap.
- ⬜ Add desktop regression coverage for picker import, drag-drop import, save/open,
  and export where practical.

### M25 — Import and Export Technical Debt 🟡

- ⬜ Move TopoJSON/KML/GPX/Shapefile parsing to an import-job worker layer.
- ⬜ Preserve progress/error reporting for large imports, with cancellation and
  per-file status.
- 🟡 Add file-size / memory guardrails for very large imports and embedded images.
- ⬜ Export edited GeoJSON features as real SVG vector paths instead of baking them
  into the map raster.
- ⬜ Decide whether vector GeoJSON SVG output is controlled by layer setting,
  export setting, or automatic capability detection.
- ✅ Add an export fidelity matrix in the export dialog/tests that explains what
  stays editable per format and what is flattened/rasterized.

### M26 — Performance Acceptance 🟡

- ⬜ Verify web cold start stays under PRD target after the Phase 3 surface area.
- ⬜ Verify 60 fps pan/zoom with demo basemap, 10k features, and 200 annotations.
- ⬜ Verify 60 fps dragging 25 selected annotations.
- ⬜ Verify 10 MB import parse + render target after worker migration.
- ⬜ Verify PNG export target for 4000x3000 @2x.
- ⬜ Verify desktop cold start and memory target.
- ⬜ Emit trendable performance artifacts in CI: cold start, import parse/render,
  vector-edit interaction, export time, heap, and bundle sizes.
- ✅ Add storage-health reporting for autosave/recents: detect IndexedDB/quota
  failures, show a non-blocking warning, and expose cache/draft size in Settings.

### M27 — Managed Offline Basemap Cache ⬜

- ⬜ Add a Settings-managed "Offline basemaps" surface where users can cache a
  country, region, or custom bounding box into the app's data directory.
- ⬜ Let users choose a maximum zoom/detail level before download.
- ⬜ Estimate download size and on-disk size before caching; show the selected
  area, zoom range, and expected storage impact before confirmation.
- ⬜ Store cached basemap archives/tiles in app data, not inside `.cartoproj`.
- ⬜ Let projects reference a managed cached basemap by stable cache id plus human
  label; keep local PMTiles absolute-path support separate from managed caches.
- ⬜ Provide pause/cancel/delete controls, last-updated metadata, and cache-size
  cleanup from Settings.
- ⬜ Use cached basemaps automatically when available, with a clear fallback to
  online basemaps when a cache is missing, stale, or outside its covered area.
- ⬜ Preserve web/macOS parity where possible: web may use browser storage quotas
  and desktop may use app data, but the user-facing cache workflow should match.

---

## Phase 4 — Cartographic Depth and Print Production ⬜

Goal: deepen GeoCarto's cartography and print output after the current editor is
stable, covered, and performant.

### M28 — Unified Annotation Scene Graph ⬜

- ⬜ Replace the current triple-renderer duplication across Konva, raster export,
  and SVG export with a shared render specification.
- ⬜ Use that shared spec to reduce export drift for annotations, effects, and map
  furniture.
- ⬜ Treat this as the prerequisite for editable-vector PDF.

### M29 — Print-Grade Export ⬜

- ✅ Vector PDF shipped via a pragmatic route — reuses the existing SVG
  exporter's output (all 14 annotation/furniture kinds) converted with
  svg2pdf.js, rather than waiting on the unified scene graph. Raster PDF
  remains the fallback option.
- ⬜ Editable-vector PDF generated from the unified scene graph (M28) — not
  needed for the above, but still the long-term dedup fix.
- ⬜ Later print-house features: CMYK/ICC handling, bleed/margins, and presets.
- ⬜ Templates gallery for editorial and classroom outputs.

### M30 — Pro-Grade Vector Editing ⬜

- ⬜ Snap to existing vertices/edges.
- ⬜ Split, merge, and reshape operations.
- ⬜ Multi-feature operations.
- ⬜ Topology-aware editing where useful.

### M31 — Analysis and Thematic Mapping ⬜

- ⬜ Attribute joins.
- ⬜ Choropleth class wizard.
- ⬜ Proportional symbols and dot density.
- ⬜ Simple buffering.
- ⬜ GeoPackage import.

### M32 — Editorial Projections ✅

- ✅ Non-Mercator map projections: Equal Earth, Robinson, Winkel Tripel, Bonne,
  Natural Earth I, chosen via a distinct `projected` document engine (no tile
  basemap; bundled Natural Earth land outlines + the user's own layers).
- ✅ Parallel d3-geo / d3-geo-projection path (`ProjectedMapView`, `CanvasProjection`
  bridge) for projection-aware rendering, raster export, and vector SVG export.
- ⬜ Interactive drag-to-rotate/wheel-to-scale composition (v1 shipped numeric
  center-longitude/scale controls only).
- ⬜ Vector editing (terra-draw) and feature-picking on projected documents.

---

## Phase 5 — Distribution, Collaboration, and Extensibility ⬜

Goal: broaden reach after the core editor, data editing, and print pipeline are
stable.

### M33 — Desktop Distribution ⬜

- ⬜ Sign and notarize the macOS build.
- ⬜ Produce and QA Windows and Linux desktop builds from the existing Tauri
  overlays.
- ⬜ Improve macOS platform integration where it helps real workflows.

### M34 — Sharing and Collaboration ⬜

- ⬜ Cloud project sync.
- ⬜ Share links.
- ⬜ Real-time collaboration over the `.cartoproj` model.

### M35 — Interactive and Extensible Platform ⬜

- ⬜ Interactive HTML export with pan/zoom/tooltips.
- ⬜ Plugin / extension API.
- ⬜ Decompose large editor components and formalize public module boundaries
  before exposing extension points.

---

## Export Contract

| Format | Status | Notes |
| --- | --- | --- |
| PNG | ✅ Shipped | Phase 1 raster export from the composition frame. |
| JPEG | ✅ Shipped | Same raster pipeline, with quality controls. |
| SVG | ✅ Shipped | Annotations/furniture are vector; Mercator map/data are raster, projected-engine data layers are real vector paths. |
| GeoJSON | ✅ Shipped | Editable data can be exported per layer or all at once. |
| PDF (raster) | ✅ Shipped | Raster-in-PDF sized to the composition frame; kept as the safe fallback. |
| PDF (vector) | ✅ Shipped | Default mode — SVG exporter output converted with svg2pdf.js; data layers still rasterize on Mercator documents. |
| Interactive HTML | ⬜ Phase 5 | Planned with sharing/extensibility work. |

## Architecture Invariants

- The `.cartoproj` document is the source of truth. MapLibre, deck.gl, Konva,
  terra-draw, and export code are projections/renderers of that model.
- App-level preferences live in `localStorage` and remain separate from per-project
  `.cartoproj` state.
- Managed offline basemap caches live in app/browser data, not inside `.cartoproj`;
  projects reference them by id/metadata. Desktop local PMTiles file basemaps may
  use absolute native paths until a relink/portable asset workflow is designed.
- Annotation editing happens on the Konva stage above MapLibre.
- Data-layer editing uses `terra-draw` as a controlled editor; commits update the
  layer `FeatureCollection`.
- Desktop behavior is additive and guarded by `isTauri()` so the web app remains a
  first-class target; web and macOS should keep feature parity at the user-facing
  workflow level.

## Open Questions

- What fidelity bar is required before SVG data layers switch from raster fallback
  to default vector output?
- Which print-house requirements matter first: editable-vector PDF, CMYK/ICC,
  bleed/margins, or templates?
- What is the French terminology owner/process for future cartographic strings?
- Which source/provider and licensing model should power managed country/region
  basemap cache downloads?
