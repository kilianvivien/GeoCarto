# GeoCarto — Implementation Progress

Tracks delivery against `docs-mocks/PRD.md` and `docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md`.
Status legend: ✅ done · 🟡 in progress · ⬜ not started · ➡️ moved to a later phase.

GeoCarto is a "Figma for maps" — an open-canvas cartography editor that runs in
the browser (Phase 1) and as a native macOS app. Five delivery phases:
**Phase 1 / MVP exit hardening**, **Phase 2 / v1 Editorial**,
**Phase 3 / Editable Data & Reach**, **Phase 4 / Cartographic Depth & Print
Production**, and **Phase 5 / Collaboration, Platform & Extensibility**.

Detailed phase plans live alongside this tracker:
`docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md` and
`docs-mocks/PHASE3_IMPLEMENTATION_PLAN.md`.

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
can't survive save/reopen). M11 left this open for web; the desktop FS path in
**Phase 3 / M23** resolves it.
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
Cloud share links move to Phase 5.

### Basemap sources & styling 🟡

The basemap must be **user-selectable**, from either an online source or a custom
base — this is a core editorial requirement.

- ✅ Built-in style presets: Editorial Light, Editorial Dark, Minimal Grey, Print B&W
- ✅ **Basemap source picker** (M11):
  - ✅ Online: hosted Protomaps PMTiles / standard tile or style URLs
  - ✅ Custom: user-supplied MapLibre style URL
  - 🟡 Custom: PMTiles URL supported; local PMTiles file deferred because
  persisted `blob:` URLs break save/reopen
  - ➡️ Offline: bundled / downloaded regional basemap packs — never built in
        Phase 2; absorbed into **Phase 3 / M24** (desktop)
- ✅ Basemap sub-layer toggles (M11): roads, labels, water, landuse, buildings,
boundaries. Filter applied at style-build time by Protomaps
`source-layer`; persisted per project; chips in MapSetupPanel + status-bar
popover for editing mode. `style-url`/`static` basemaps hide the chips.
- ✅ Persist the chosen basemap source + sub-layer mask in `.cartoproj`
(with a defaulting migration for Phase 1 documents).

### Richer annotation & styling ✅

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
composition frame. Editable-vector PDF moves to Phase 4 (unified scene graph).
- ➡️ Move heavy importers onto a worker thread (parsers are pure and
worker-ready). **Folded into Phase 3 / M22.**
- ➡️ GeoJSON-as-editable-vector-paths in SVG (currently embedded in the basemap
raster). Naturally pairs with vector editing — **folded into Phase 3 / M22.**

### Desktop (macOS) 🟡 Shell shipped; hardening + offline packs remain

The Tauri 2 macOS desktop app is **already built and working** (non-notarized).
Every desktop path in `src/` is additive and guarded by `isTauri()`; the web build
keeps full feature parity. See `src-tauri/README.md`.

- ✅ Tauri 2 shell — Rust backend (`src-tauri/src/lib.rs`), `npm run tauri:dev` /
      `tauri:build` produce a bundled `.app`/`.dmg`. **Not signed / not notarized**
      (intentionally deferred — distribution is direct `.dmg` for now).
- ✅ Native file open/save dialogs via `plugin-dialog` + `plugin-fs`
      (`src/project/fileSystem.ts`); native export save dialog (`src/export/raster.ts`).
- ✅ Default basemap PMTiles fetched through `plugin-http` (`TauriHttpSource` in
      `src/basemap/pmtiles.ts`) so WKWebView CORS can't break the built-in basemap.
- ✅ Native window chrome — Overlay title bar + real traffic lights, macOS vibrancy
      via `macos-private-api`; native app menu + ⌘ shortcuts (`src/ui/KeyboardShortcuts.tsx`).
- ➡️ Local PMTiles **file** basemaps via the native FS path (deferred from M5/M11
      because persisted `blob:` URLs break web save/reopen) — **Phase 3 / M23**.
- ➡️ Offline regional basemap packs with a first-run download/bundle choice —
      **Phase 3 / M24**.
- ➡️ Signing + notarization for friction-free distribution — **Phase 5**
      (non-notarized direct-`.dmg` distribution is acceptable for now).
- ⬜ Drag-drop import on desktop — **confirmed broken** (verified 2026-05-30). The web
      handler (`MapCanvas.tsx`) reads `e.dataTransfer.files`, but the window leaves Tauri's
      `dragDropEnabled` at its v2 default of `true`, so the webview intercepts OS file drops
      and fires `tauri://drag-drop` instead of populating `dataTransfer.files` — and no
      Tauri drop listener exists. Fix: either set `dragDropEnabled: false` in
      `tauri.conf.json` (re-enables in-webview HTML5 drop; simplest, no native drop events
      are used) or add an `isTauri()`-guarded `onDragDropEvent` listener that feeds dropped
      paths through the FS plugin into `importGeoJsonFiles`. (File picker import is
      unaffected and works on desktop.)

---

## Phase 3 / Editable Data & Reach ⬜

Goal: turn imported data from read-only into **editable**, make the app **multilingual
and discoverable**, give users a real **preferences surface**, and ship the **macOS
desktop** build. The unfinished Phase 2 desktop / import / export items are folded in
here so the desktop release lands as one coherent v2.

Detailed breakdown: `docs-mocks/PHASE3_IMPLEMENTATION_PLAN.md`.

### GeoJSON vector editing — core ⬜ (M17–M18)

The current GeoJSON pipeline is render-only: clicking a feature opens the attribute
inspector, but geometry can't change and new features can't be drawn. Phase 3 adds an
**edit mode** built on `terra-draw` (already in the PRD stack, not yet installed).

- ⬜ Install `terra-draw` + its MapLibre adapter; wire it as a **controlled editor**.
terra-draw owns no canonical state — every edit commits back into the layer's
`GeoJsonLayer.data` `FeatureCollection`, which stays the source of truth, then the
existing `syncLayers` path re-renders (architecture invariant preserved).
- ⬜ Per-layer **edit mode**: pick an unlocked GeoJSON layer to edit; the feature-select
→ attribute-inspector click behavior yields to the editor while active.
- ⬜ **Vertex editing** — move / add / delete vertices on existing line & polygon
features; **drag** whole features; all in geo-space (lng/lat), distinct from the
Konva canvas-space polygon handles in `AnnotationStage.tsx`.
- ⬜ **Draw new features** — point / line / polygon tools that append a `Feature` into the
active layer with editable properties.
- ⬜ **Delete features**; update `featureCount` and allow `geometry: 'mixed'`.
- ⬜ **Editable attributes** — the attribute inspector gains add / rename / delete / edit
of feature properties (today it is read-only inspection).
- ⬜ **Undo/redo** integration — geometry edits hint `hintHistoryLabel` and coalesce drag
bursts via the existing 400 ms window, so feature edits are first-class history steps.
- ⬜ Respect **locked layers** (no edits) consistent with existing lock rules.
- ⬜ Round-trips through `.cartoproj`, raster, and SVG/PDF export with no schema change
(data is already canonical GeoJSON).
- Note: snapping to existing vertices/edges, split/merge, and topology-aware editing are
**out of scope** here — they ship as Phase 4 "pro-grade vector editing".

### Localization (i18n) — French + English ⬜ (M19)

No localization exists today; ~all UI strings are hardcoded English across ~40 components.

- ⬜ Lightweight typed message-catalog i18n (no heavy runtime dep; keeps bundle budget),
`t()` hook + React context, English as the base catalog.
- ⬜ Extract all UI strings (toolbar, menus, inspector, dialogs, toasts, status bar,
shortcuts help) into catalogs; lint/test guard against new hardcoded strings.
- ⬜ **French** translation, reviewed for cartographic/editorial terminology.
- ⬜ Locale **auto-detected** from the browser, with a **manual override** in the settings
modal; persisted across sessions.
- ⬜ Locale-aware number / distance / area / date formatting via `Intl` (ties into the
ruler readouts and scale bar).
- ⬜ Catalog structure ready for further languages without code changes.

### UI discoverability — tooltips & help ⬜ (M20)

Tooltips today are bare native `title=` attributes; there's no design-system tooltip.

- ⬜ A reusable **glass tooltip** component matching `design.md` (delay, placement,
keyboard-shortcut chip), accessible (focus + hover, `aria-describedby`).
- ⬜ Every tool in the rail gets a tooltip: **name + one-line description + shortcut**
(e.g. "Pen — draw a freehand or segmented line · P").
- ⬜ Tooltips on inspector controls, status-bar toggles, furniture menu, and export
options; all strings localized.
- ⬜ Optional lightweight first-run hint / "what's this" affordance for the core loop.

### Settings modal ⬜ (M21)

No preferences surface exists; settings are scattered (theme, snap, units in the status bar).

- ⬜ A **Settings modal** (⌘,) grouping: Language, Appearance (theme / accent),
Units (metric / imperial default), Canvas (grid snap defaults, smart guides,
grid spacing), Autosave interval, Default basemap, and Reset-to-defaults.
- ⬜ Preferences persisted to `localStorage` (app-level, distinct from per-project
`.cartoproj` settings) with a typed schema + defaulting migration.
- ⬜ Existing scattered controls read from / write to the same preference store so there's
one source of truth for app settings.

### Folded-in Phase 2 completion ⬜ (M22–M24)

- ⬜ **Worker-thread importers** (M22) — move TopoJSON/KML/GPX/Shapefile parsing off the
main thread (parsers are already pure/worker-ready).
- ⬜ **GeoJSON-as-editable-vector-paths in SVG** (M22) — edited features export as real
vector paths instead of being baked into the basemap raster; pairs with M17.
- ✅ **Tauri 2 desktop shell** — already shipped (non-notarized): native open/save +
export dialogs, HTTP-plugin basemap fetch, native window chrome, full web parity behind
`isTauri()`. See the Phase 2 Desktop section + `src-tauri/README.md`. Phase 3 only adds
the remaining desktop capabilities below.
- ⬜ **Local PMTiles file basemaps** (M23) — resolved on desktop via the native FS path
(the `blob:` save/reopen limitation that blocked web in M5/M11).
- ⬜ **Offline regional basemap packs** (M24) — first-run download / bundle choice for
desktop.

### Resilience & stabilization ⬜ (M25)

- ⬜ **Top-level React error boundary + crash-safe recovery** (moved up from the code
audit). No error boundary exists today, so a single render error takes down the whole
editor and risks unsaved work. Add a boundary that catches render failures, preserves the
active session, and offers autosave recovery. Slotted at the end of Phase 3 so it wraps the
new vector-edit / i18n / settings surfaces shipped earlier this phase in one fail-safe net.
- ⬜ Playwright flows for vector edit (move vertex, draw feature, delete, attribute edit,
undo/redo round-trip), locale switch, settings persistence, and tooltip presence.
- ⬜ Unit tests for the edit→`FeatureCollection` commit, attribute mutations, i18n
catalog completeness (no missing keys), and preferences defaulting/migration.
- ⬜ Bundle-budget re-check (terra-draw lazy-loaded behind edit mode; i18n catalogs split).
- ⬜ Performance: editing a feature in a 10 MB layer stays within PRD §7 interaction targets.

---

## Phase 4 / Cartographic Depth & Print Production ⬜

Goal: deepen the *cartography* — real GIS editing and analysis, non-Mercator
projections, professional print output — and pay down the rendering debt that print
output depends on. This phase turns GeoCarto from an editorial annotator into a tool
that can produce analytically-correct, print-house-ready maps.

### GIS depth ⬜

- ⬜ Pro-grade vector editing: snapping to vertices/edges, split/merge, topology-aware
      editing, multi-feature operations (extends the Phase 3 core editor).
- ⬜ Analysis features: attribute joins, choropleth class wizard, proportional symbols,
      dot density, simple buffering.
- ⬜ Non-Mercator editorial projections (Robinson, Equal Earth, Winkel Tripel, Bonne…)
      via a parallel d3-geo / d3-geo-projection pipeline.
- ⬜ GeoPackage import.

### Print production ⬜

- ⬜ **Unified annotation scene-graph** (folded from the code audit). Today every
      annotation kind is rendered three times over — `AnnotationStage.tsx` (Konva),
      `export/renderAnnotations.ts` (raster), and `export/svg.ts` (SVG) each switch over
      the same kinds and must be hand-mirrored or export drifts. Consolidate to one
      render-spec that the on-canvas, raster, and SVG renderers all derive from. This is
      the *prerequisite* for the next item.
- ⬜ PDF export from the unified scene graph (editable vector PDF, replacing today's
      raster-in-PDF); later CMYK + ICC for print houses.
- ⬜ Templates gallery for editorial and classroom outputs.

### Quality foundation ⬜

- ⬜ **CI pipeline** (folded from the code audit). The plan already gates on
      `bundle-budget`, the Phase-tool vitest invariant, lint, typecheck, and Playwright,
      but there is **no `.github/workflows`** — those gates run only locally. Stand up CI
      that runs lint / typecheck / unit / e2e / bundle-budget on every PR.
- ⬜ **Coverage thresholds** (folded from the code audit). No coverage tooling is
      configured; add coverage reporting with a floor for the document/store/export core
      so the heavy GIS additions below land with safety rails.

---

## Phase 5 / Collaboration, Platform & Extensibility ⬜

Goal: extend GeoCarto's *reach* — multi-user, multi-platform, and open to third-party
extension — and harden the resilience and module boundaries that those capabilities
require.

### Collaboration & sharing ⬜

- ⬜ Cloud project sync and share links.
- ⬜ Real-time collaboration (Yjs CRDT over the `.cartoproj` model).
- ⬜ Interactive HTML export (self-contained, pan/zoom/tooltips).

### Platform reach ⬜

- ⬜ Windows and Linux desktop builds (extends the existing macOS Tauri shell).
- ⬜ Signing + notarization for the macOS build (the shell already ships unsigned;
      this removes the Gatekeeper friction for public distribution).

### Extensibility ⬜

- ⬜ Plugin / extension API.
- ⬜ **Decompose god components & formalize module boundaries** (folded from the code
      audit). `AnnotationStage.tsx` (~2.2k lines) and `AnnotationInspector.tsx` (~1.1k
      lines) are the two largest files; a stable public extension surface needs clean,
      documented seams first. Pairs with the Phase 4 scene-graph refactor.

---

## Cross-cutting concerns

### Export contract (PRD §5.4)


| Format           | Phase            | Status                                                                                   |
| ---------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| PNG              | Phase 1          | ✅ Milestone 5                                                                            |
| JPEG             | Phase 1          | 🟡 Milestone 5; broader acceptance coverage added                                        |
| SVG              | v1 (after spike) | ✅ M15 (basemap raster + vector annotations); ➡️ GeoJSON-as-vector-paths in Phase 3 / M22 |
| PDF              | Phase 2 / 4      | ✅ M15 (raster-in-PDF); ⬜ editable vector PDF from the unified scene graph in Phase 4    |
| Interactive HTML | Phase 5          | ⬜ Phase 5 (Collaboration, Platform & Extensibility)                                     |


### Performance targets (PRD §7)

- ⬜ Web cold start < 2s to interactive (cached)
- ⬜ 60 fps pan/zoom with demo basemap + 10k features + 200 annotations
- ⬜ 60 fps dragging 25 selected annotations
- ⬜ 10 MB GeoJSON parse + render < 3s
- ⬜ PNG export 4000×3000 @2x < 5s
- ⬜ Desktop (Phase 3): < 1.5s cold start, 60 fps at editorial scale, < 700 MB resident

### Platform delivery (PRD §5.5)

- ✅ Phase 1 web — Vite SPA, static-hosting ready
- ✅ Desktop macOS — Tauri 2 shell shipped (**not signed / not notarized**); native
  dialogs + HTTP-plugin basemap fetch. Signing/notarization → Phase 5.
- ⬜ Windows + Linux — **Phase 5**

### Architecture invariants (PRD §3–4)

- The `.cartoproj` document is the single source of truth; MapLibre, deck.gl,
Konva, and export are renderers/projections of it — never independent state.
- Annotation editing lives on a Konva stage above the MapLibre canvas, camera-
synced to the map's view state.
- Dual anchoring (`geoAnchor` / `screenAnchor` / `hybridAnchor`) is exposed per
annotation in the inspector.
- **Phase 3:** `terra-draw` is a *controlled editor* — feature geometry edits commit
into the layer's `FeatureCollection` (canonical), never a parallel store. App-level
preferences (language, theme, units, snap defaults) live in `localStorage`, separate
from per-project `.cartoproj` settings.

### Code quality baseline (audit 2026-05-30)

A quick audit at v0.1.0. The codebase is healthy overall — ~zero TODO/FIXME markers,
only 5 `any` usages (all justified deck.gl / topojson typing gaps with `eslint-disable`),
and 31 test files against 72 source files. Four findings are scheduled rather than left
implicit; each is folded into the phase where it acts as an enabler:

- **Triple-renderer duplication** — `AnnotationStage.tsx`, `export/renderAnnotations.ts`,
  and `export/svg.ts` each switch over every annotation kind independently and must be
  kept in sync by hand. → **Phase 4** unified scene-graph (enabler for vector PDF).
- **No CI** — `bundle-budget`, the Phase-tool vitest invariant, lint/typecheck/e2e gates
  run only locally; there is no `.github/workflows`. No coverage tooling. → **Phase 4**
  quality foundation.
- **No React error boundary** — a render error crashes the whole editor. → **Phase 3 /
  M25** crash-safe recovery (pulled forward; the new edit/i18n/settings paths must fail safe).
- **God components** — `AnnotationStage.tsx` (~2.2k lines), `AnnotationInspector.tsx`
  (~1.1k lines). → **Phase 5** module-boundary work (prerequisite for the plugin API).

### Open questions (PRD §10)

Brand pass on the name, free vs paid model, minimum macOS/WebKit version,
desktop basemap-pack strategy, bundled vs user fonts, SVG fidelity bar, and
whether comments stay roadmap-only — to decide within the first sprints.

**Phase 3 decisions taken:** vector editing ships at "core" depth (move/add/delete
vertices, draw/delete features, edit attributes); pro-grade GIS editing moves to Phase 4.
Localization launches with French + English on a typed in-house catalog (no heavy i18n
runtime), auto-detected with a settings override. Remaining Phase 2 desktop / import /
export items are folded into Phase 3 rather than shipped as a separate v1.

**Phase 3 open questions:** i18n catalog format (flat keyed JSON vs nested) and whether
to adopt ICU plurals now or defer; settings-modal scope creep (which scattered controls
migrate in M21 vs later); how a local PMTiles file path persists across save/reopen on
desktop; and the French terminology glossary owner for cartographic terms.
(Desktop code-signing / notarization is now a Phase 5 concern, not Phase 3.)