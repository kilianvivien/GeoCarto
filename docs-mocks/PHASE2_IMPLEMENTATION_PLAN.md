# Phase 2 Implementation Plan — GeoCarto

## 1. Goal

Phase 2 turns the Phase 1 prototype into a **production-grade editorial cartography
tool** and ships the **first signed macOS desktop build**. The user can run multiple
projects side-by-side, choose any basemap source, compose with a richer styling and
annotation vocabulary, import the major editorial vector formats, and export both
high-DPI raster and editable SVG.

The phase succeeds when an editorial map maker who today falls back to Illustrator
can plausibly stay inside GeoCarto from import to final artwork.

## 2. Scope

### In scope

- **Phase 1 exit hardening** — close the remaining 🟡 items before adding scope.
- **Multi-project sessions** — tabbed workspace, per-tab autosave, dirty-state
  guards, recent projects list.
- **History** — undo/redo with ≥100 meaningful document steps.
- **Editorial canvas tools** — locked-canvas pan, marquee, ruler/measurement,
  pixel/grid snap, smart guides, object grouping.
- **Basemap source picker** — built-in presets, hosted PMTiles/tile/style URLs,
  custom MapLibre style JSON, basemap sub-layer toggles (roads, labels, water,
  landuse, buildings, boundaries); source + style persisted in `.cartoproj`.
- **Richer annotation & styling** — dashed lines, arrowheads, halos, shadows,
  patterns, blend modes, title block, source credit, scale bar, north arrow,
  manually editable legend builder.
- **deck.gl data layers** — interleaved via `MapboxOverlay`, driven from the
  document model.
- **Vector import expansion** — TopoJSON, KML, GPX, Shapefile (zipped or folder).
- **SVG export** — spike first, then editable vector serializer; raster
  fallback documented where unsupported.
- **Image placement** — drop bitmap images on the canvas (geo or screen anchored).
- **Tauri 2 macOS shell** — signed (notarization not blocking), native file
  dialogs, drag-drop import, offline regional basemap packs.
- **Performance & verification** — meet PRD §7 v1 targets on a 100k-feature /
  2k-annotation reference dataset; visual/pixel diff acceptance for raster and
  SVG export.

### Out of scope (deferred to Post-v1)

- Interactive HTML export, PDF export, CMYK/ICC print workflows.
- Real-time collaboration, comments beyond a local-only stub, share links,
  cloud project sync.
- Non-Mercator editorial projections (Robinson, Equal Earth, etc.).
- GIS analysis: joins, choropleth wizard, proportional symbols, dot density,
  buffering.
- GeoPackage import.
- Windows / Linux desktop builds.
- Plugin / extension API.
- Custom user-supplied fonts (bundled set only, decision pending §10).

## 3. Architecture decisions

- The `.cartoproj` document remains the **single source of truth**. Every new
  surface (tabs, history, deck.gl, SVG export, Tauri file IO) is a renderer or
  controller of the document, never a parallel store.
- **Multi-project state** lives in a top-level session registry; per-project
  state continues to use the existing Zustand + Immer document store, namespaced
  by `sessionId`. Autosave keys move from "current draft" to per-session.
- **Undo/redo** is implemented as an Immer patch-based history middleware on the
  document store. Renderers (MapLibre, Konva, deck.gl, exports) are pure
  projections, so replay is "diff the document, let renderers reconcile". Map
  viewport and selection are *not* part of undo history.
- **SVG export reuses the same scene graph** that drives Konva/HTML overlays and
  the MapLibre style; PDF in post-v1 will reuse this scene graph too. No
  parallel "export truth".
- **deck.gl** is interleaved with MapLibre via `MapboxOverlay` so both share the
  WebGL2 context and z-ordering. deck.gl layers are derived from document
  state, not constructed imperatively.
- **Desktop parity first, Tauri-specific behavior second**: the Tauri build is a
  thin shell over the web app. Platform features (native dialogs, offline packs,
  drag-drop) are exposed through a small `platform/` adapter so the web build
  keeps working with browser fallbacks.
- **Basemap sources** are pluggable behind a `BasemapSource` interface
  (`built-in | style-url | tile-url | pmtiles-url | pmtiles-file | offline-pack`).
  Each source declares whether it can survive save/reopen and offline.
- **Phase 2 stays Web Mercator only.** The d3-geo editorial projection pipeline
  is a Post-v1 effort and must not leak into the MapLibre style toggle surface.

## 4. Milestones

Milestones are sequenced so each one ships a usable slice. Each milestone ends
with green Playwright + Vitest runs and a manual acceptance pass on the
reference dataset.

---

### Milestone 7 — Phase 1 Exit Hardening - Done

Close out the remaining Phase 1 🟡 items so Phase 2 starts on a clean base.

- Visual/pixel diff harness for PNG/JPEG export (basemap + GeoJSON + annotations)
  against the visible composition frame; tolerance documented.
- Realistic 10 MB GeoJSON fixture committed (or scripted download) and used by
  performance smoke tests.
- Enforce PRD §7 Phase 1 thresholds in CI: cold start, import, pan/zoom, drag,
  export, memory.
- Bundle hardening: code-split MapLibre, Konva, export, and PMTiles paths; set
  an explicit bundle budget and fail CI on regression.
- Lock the toolbar Phase 1 gate: any Phase 2-flagged control is removed from the
  enabled set until its owning Phase 2 milestone lands.

Acceptance:
- All Phase 1 🟡 items in `plan.md` flip to ✅.
- CI fails on a deliberate bundle bloat or perf regression.
- Export visual diff catches a seeded one-pixel pin shift on the demo project.

---

### Milestone 8 — Multi-Project Sessions, Dirty Guards, Recents - Done

- Introduce `ProjectSession { id, project, file, dirty, autosaveKey, title,
  lastActiveAt }` and `activeSessionId` at the top of the state tree.
- Refactor the document store to be session-scoped; existing single-document
  flows route through `activeSessionId`.
- Tab bar UI in the top region of the workspace; New, Open, Close, reorder,
  switch.
- Per-session autosave to IndexedDB (replace the global "current draft" key);
  recovery prompt lists all autosaved sessions, not just one.
- Dirty-state guard on Close Tab, New, Open, Restore — reuse the existing
  Phase 1 prompt component.
- Recent projects list, persisted via File System Access API handles where
  supported, with a graceful fallback to filename-only history elsewhere.
- Window title and document.title reflect the active session.

Acceptance:
- User can open three projects, switch freely, close one with unsaved changes
  and be prompted, and recover after a reload.
- Autosave restore offers every dirty session, not just the last active one.
- Recent projects open the file directly when the browser supports it.

---

### Milestone 9 — Undo / Redo and History - Done

- Add an Immer-patch history middleware on the document store with
  `undo()` / `redo()` actions and configurable depth (default ≥100 steps).
- Group patches by *meaningful operation* — drag, multi-edit, paste, import —
  using a `withHistory(label, fn)` helper. Continuous gestures coalesce.
- Exclude transient state (selection, hover, viewport, tool mode) from history.
- Keyboard shortcuts: `⌘Z` / `⌘⇧Z`. Toolbar Undo/Redo enabled (Phase 1 gates lift).
- History inspector for QA (dev-only): list of recent labels.

Acceptance:
- 100 distinct operations on the demo project can be fully undone and redone
  without document divergence (state hash matches before/after round-trips).
- Drag of 25 annotations creates one history entry, not 25.
- Reordering layers, restyling fills, importing GeoJSON, deleting an
  annotation, and switching basemap source are each independently undoable.

---

### Milestone 10 — Editorial Canvas Aids - Done

- **Locked-canvas pan tool** — when the map is locked, pan moves the composition,
  not the map viewport. Shortcut: `H`.
- **Marquee select** across geo + canvas objects (with modifier-key add/remove).
- **Ruler / measurement tool** — distance and area in metric/imperial, anchored
  to two or more points; rendered as an annotation type so it persists.
- **Pixel / grid snap** — configurable spacing, toggle in the bottom bar.
- **Smart guides** — edge and center alignment cues during drag, à la Figma.
- **Object grouping** — `⌘G` / `⌘⇧G`; groups participate in selection,
  transforms, and locking. Persisted in `.cartoproj`.

Acceptance:
- Each tool that was disabled in Phase 1 exit hardening is now enabled and
  passes its Playwright flow.
- Smart guides snap a rectangle to a pin center within the documented tolerance.
- Grouped objects round-trip through save/reopen unchanged.

---

### Milestone 11 — Basemap Source Picker and Sub-Layers - Done

- Generalize basemap state to `BasemapSource` discriminated union:
  - `built-in` (existing presets)
  - `style-url` (any MapLibre style JSON URL)
  - `tile-url` (XYZ raster or vector)
  - `pmtiles-url` (already partial in Phase 1)
  - `offline-pack` (desktop only; see Milestone 16)
- Source picker UI inside the basemap setup flow, including paste-a-URL and a
  small "Try one of these" gallery.
- Sub-layer visibility toggles (roads, labels, water, landuse, buildings,
  boundaries) driven by style-spec filtering; persisted per project.
- Built-in style presets expanded with Minimal Grey and Print B&W tuned for
  print output.
- Persist `basemap.source`, `basemap.style`, and `basemap.sublayers` in
  `.cartoproj`; migration path for Phase 1 documents.
- Validate URLs on load; surface friendly errors when a source 404s or violates
  CORS, with an "open project anyway, basemap missing" recovery.

Acceptance:
- A project saved with each source type reopens with the correct basemap.
- Toggling "labels" off in the demo project hides labels on screen and in
  export.
- A broken style URL surfaces a clear error and lets the user pick a fallback.

---

### Milestone 12 — deck.gl Data Layers and Richer Styling

- Wire `MapboxOverlay` into `MapView` and add a `DeckOverlay.tsx` driven by
  document state.
- Introduce a "data layer" concept in the document distinct from "imported
  GeoJSON layer": same source, different render strategy.
- Implement editorial styling primitives on geo and annotation layers:
  - Dashed lines and dash patterns
  - Arrowheads (line caps, both ends, configurable size)
  - Halos and outer/inner shadows
  - Pattern fills (from a bundled set)
  - Blend modes (normal, multiply, screen, overlay)
- Extend the inspector to expose these without overwhelming the casual user
  (progressive disclosure / "More" panel).
- Ensure all new style fields are part of the schema with migrations.

Acceptance:
- deck.gl renders a sample heatmap layer interleaved with MapLibre roads
  without z-order glitches.
- Each new style primitive round-trips in save/reopen and appears in PNG export.
- Performance smoke still hits 60 fps with the styled demo project.

---

### Milestone 13 — Map Furniture and Legend Builder

- **Title block, source credit, scale bar, north arrow** as first-class
  annotation types with screen anchors and per-project defaults.
- Scale bar tracks the map's current scale and re-renders correctly in export.
- North arrow follows map bearing.
- **Legend builder** — manually editable legend annotation that can:
  - Pull entries from selected layers' styles
  - Be edited as free-form rows (swatch + label)
  - Reorder, group, hide entries
- All furniture honours geo/screen/hybrid anchoring like other annotations.

Acceptance:
- A user can drop a title block, credit, scale bar, north arrow, and legend in
  under 60 seconds on the demo project, and they all export correctly.
- Editing a layer style updates the legend swatch when the entry is linked,
  and stays untouched when the user has overridden it.

---

### Milestone 14 — Vector Import Expansion and Image Placement

- TopoJSON import (via `topojson-client`).
- KML and GPX import (via `togeojson` or equivalent), normalized to the same
  GeoJSON-shaped internal model.
- Shapefile import — accept zipped `.shp`/`.dbf`/`.shx`/`.prj` bundles via
  `shapefile` or `shpjs`, with worker parsing.
- Centralize import in a worker so the main thread stays responsive on large
  files; show progress in the toast system.
- Document the import size cap and friendly error path.
- **Image placement tool** — drop PNG/JPEG/SVG raster onto the canvas; geo or
  screen anchored; embedded as base64 in `.cartoproj` (Phase 1 plain JSON
  stays human-readable but bloats — accept this trade for v1; revisit zip
  bundle later).

Acceptance:
- Each format imports the reference dataset within PRD §7 thresholds.
- A reprojected Shapefile (non-WGS84 with a `.prj`) lands in the right place on
  the map.
- An embedded image survives save/reopen and exports at full DPI.

---

### Milestone 15 — SVG Export

This milestone is sequenced explicitly: **spike first, then production**.

- **Spike (Milestone 15a)** — export the §5.4 spike scene (basemap region, one
  GeoJSON layer, text, shape, line, pin, legend, source credit). Open in
  browser, Illustrator, and Figma. Document what stays editable, what
  rasterizes, and what's missing.
- **Decision gate** — if the spike clears the fidelity bar (TBD against §10),
  proceed; otherwise punt SVG to Post-v1 and ship Phase 2 raster-only.
- **Production (Milestone 15b)** — vector serializer using the shared scene
  graph:
  - Annotations → SVG primitives, grouped per logical layer
  - Imported GeoJSON → projected paths (`d3-geo` Mercator), styled to match
    the live render
  - Basemap → tile composite, embedded as `<image>` for unsupported style
    features and as paths where feasible
  - Text → real `<text>` with the bundled font family declared
  - Effects (halo, shadow, pattern) — preserved via SVG filters or rasterized
    with an explicit note in the export dialog
- Export dialog gains an SVG tab with options: include basemap raster yes/no,
  embed fonts (bundled set only), flatten effects.

Acceptance:
- SVG opens in Illustrator with editable groups for supported objects.
- Visual diff against the canvas is within tolerance for supported features.
- The export dialog clearly marks anything that rasterized.

---

### Milestone 16 — Tauri 2 macOS Shell

- Add `src-tauri/` with Tauri 2 setup; minimum macOS version decided per §10.
- Native file open/save dialogs replace the File System Access API on desktop;
  the web build keeps its existing path via the `platform/` adapter.
- Drag-drop file import wired through Tauri APIs.
- Recent projects backed by an OS-level bookmark list.
- **Offline regional basemap packs** — first-run download or bundled choice;
  packs are PMTiles archives stored under the app data dir and registered as
  `offline-pack` basemap sources.
- macOS app menus: File / Edit / View / Help; native shortcuts.
- Signed build with a developer ID; notarization is **not** blocking for the
  Phase 2 cut (PRD §1 explicitly defers notarization).
- CI builds the unsigned `.app` and `.dmg`; signing happens locally for now.

Acceptance:
- The signed `.app` launches and runs the full editorial loop offline using a
  bundled regional pack.
- File round-trips through native dialogs work for `.cartoproj`, GeoJSON,
  TopoJSON, KML, GPX, Shapefile, and image imports.
- Cold start meets the v1 desktop target (< 1.5 s on the reference Mac).

---

### Milestone 17 — Verification, Performance, and Stabilization

- Extend Playwright coverage for every Phase 2 surface: tabs, undo/redo,
  basemap picker, deck.gl, furniture, legend builder, new imports, image
  placement, SVG export, Tauri-specific flows where automatable.
- Build the v1 reference dataset: ~100k vector features + ~2k annotations;
  commit a script that regenerates it.
- Enforce v1 PRD §7 thresholds in CI (web) and a manual run sheet (desktop).
- Visual diff acceptance covers PNG, JPEG, and SVG exports.
- Memory ceiling check on desktop: < 700 MB resident at editorial scale.
- Triage and fix usability blockers surfaced by the editorial dogfood pass.

Acceptance:
- All Phase 2 acceptance tests pass in CI.
- v1 desktop meets cold start, pan/zoom, and memory targets on the reference
  Mac.
- A non-technical editorial user can complete the §8 Definition of Done loop
  unaided.

---

## 5. Technical spikes

Run these *before* their owning milestone, not in parallel with it.

- **History granularity** (M9) — confirm Immer patch-based history scales to
  100+ entries on the v1 reference dataset without GC stalls.
- **Basemap source survival** (M11) — verify each source type round-trips
  through save/reopen on web and desktop, including failure modes
  (offline, 404, CORS).
- **deck.gl + MapLibre interleaving** (M12) — confirm z-order, depth, and
  picking behaviour with both engines active on the reference dataset.
- **SVG export fidelity** (M15a) — the explicit decision gate above.
- **Tauri + WKWebView** (M16) — pin the minimum macOS version, confirm
  Phase 1 features survive on WKWebView, document any divergence from
  Chromium-on-web.
- **Offline pack format** (M16) — decide between bundled-in-binary,
  first-run download, or both; size and licensing implications.

## 6. Test plan

- **Unit tests** — history middleware, session registry, basemap source
  validation, importer parsers (one per format), scale bar / north arrow
  math, SVG serializer per primitive.
- **Component tests** — tab bar, undo/redo toolbar state, basemap picker,
  inspector progressive-disclosure panels, legend builder.
- **Playwright e2e** — every milestone listed above ships its own flow.
- **Visual diff** — PNG, JPEG, and SVG exports against committed baselines
  with tolerance per format.
- **Performance** — CI smoke (web) and a documented manual run sheet
  (desktop) against the v1 reference dataset.
- **Tauri-specific** — a small smoke harness running the built `.app`
  headlessly where possible; otherwise documented manual checks.

## 7. Risks and mitigations

- **History scope creep** — undo/redo of viewport, selection, or tool state
  bloats history and confuses users. *Mitigation:* exclude transient state
  by construction; only document mutations enter history.
- **SVG fidelity disappointment** — editorial users expect Illustrator-grade
  output. *Mitigation:* run the spike before committing, and accept the
  raster fallback decision early if needed.
- **deck.gl interleaving regressions** — adding `MapboxOverlay` can shift
  z-order or break export composition. *Mitigation:* visual diff covers
  deck.gl scenes; spike before milestone commits.
- **Tauri WebKit divergence** — features that work in Chromium dev may
  break on WKWebView. *Mitigation:* run the Phase 1 acceptance suite on
  Tauri before Phase 2 features land.
- **Bundle bloat from new importers and exporters** — many parsers, easy
  regression. *Mitigation:* lazy-load every importer/exporter behind its
  entry point; enforce the bundle budget set in Milestone 7.
- **State refactor for sessions** — touching the document store risks
  regressing every Phase 1 flow. *Mitigation:* land Milestone 8 behind a
  flag with the full Phase 1 Playwright suite green before removing the
  single-session path.
- **Schema churn** — Phase 2 adds many fields. *Mitigation:* every field
  ships with a defaulting migration and a schema version bump; Phase 1
  documents must continue to open.

## 8. Definition of Done

Phase 2 is done when:

1. A new editorial user can open the app (web or signed macOS desktop),
   pick any basemap source, import a Shapefile and a GeoJSON, annotate
   with the full Phase 2 vocabulary including title, scale bar, north
   arrow, and legend, save, reopen, and export both a print-ready PNG
   and an editable SVG that opens cleanly in Illustrator.
2. Multi-project, undo/redo, snap, ruler, marquee, smart guides, and
   image placement are all enabled and tested.
3. All PRD §7 v1 performance and memory targets are met on the reference
   datasets.
4. All Phase 2 acceptance tests pass.
5. The signed macOS desktop build runs the full editorial loop offline
   using a regional basemap pack.
6. The plan.md status reflects ✅ for every Phase 2 line item except
   those explicitly punted to Post-v1 with a written rationale.
