# Phase 3 Implementation Plan — GeoCarto

> Status tracker lives in `plan.md`. This document is the detailed plan for the
> upcoming phase. Phase 2 delivered M7–M15; its planned M16 (offline basemap packs)
> was never built and is absorbed here as M24. Phase 3 spans **M17–M25**.

## 1. Goal

Phase 3 — **Editable Data & Reach** — turns GeoCarto from a "place data, annotate,
export" tool into one where the data itself is **editable**, the interface is
**multilingual and discoverable**, and the user has a real **preferences surface**.

> Note: the **macOS Tauri desktop app is already shipped** (non-notarized) — native
> dialogs, HTTP-plugin basemap fetch, and native window chrome all work today behind
> `isTauri()`. Phase 3 does not "build the desktop app"; it *extends* it with the two
> capabilities the shell still lacks (local PMTiles files, offline packs) and folds in the
> remaining Phase 2 import/export work.

Four user-facing pillars, plus the remaining Phase 2 work folded in:

1. **GeoJSON vector editing (core)** — move/add/delete vertices, drag features, draw new
   features, edit attributes, delete features.
2. **Localization** — French + English, auto-detected with a manual override.
3. **UI discoverability** — design-system tooltips on every tool and control.
4. **Settings modal** — a single preferences surface (⌘,).

This phase should feel like a maturing v2: the editor becomes a place you *change* data,
not just decorate it, and it speaks the user's language. It does **not** need pro-grade
GIS editing (snapping/topology/split-merge), additional projections, cloud sync, or
Windows/Linux builds — those are scheduled for Phase 4 (GIS depth / print) and Phase 5
(collaboration / platform).

## 2. Scope

### In scope

- An **edit mode** for imported GeoJSON layers built on `terra-draw` as a controlled editor.
- Vertex move/add/delete and whole-feature drag for line & polygon features (geo-space).
- New-feature drawing tools (point / line / polygon) that append into the active layer.
- Feature deletion; editable feature attributes (add / rename / delete / edit properties).
- Undo/redo coverage for all geometry and attribute edits.
- A lightweight typed i18n layer (English base + French), `t()` hook, string extraction.
- Locale auto-detection with a manual override; locale-aware number/distance/area/date.
- A reusable glass tooltip component; tooltips on tools, inspector, status bar, menus.
- A Settings modal grouping Language, Appearance, Units, Canvas, Autosave, Default basemap.
- App-level preferences persisted to `localStorage` (separate from `.cartoproj`).
- Worker-thread parsing for the multi-format importers.
- GeoJSON-as-editable-vector-paths in SVG export.
- Desktop **extensions** to the existing (already-shipped, non-notarized) macOS Tauri
  shell: local PMTiles **file** basemaps and offline regional basemap packs.
- A top-level React error boundary with crash-safe session recovery.
- Playwright + Vitest coverage for all of the above.

### Out of scope (deferred to Phase 4 / Phase 5)

- Pro-grade GIS editing: snapping to existing vertices/edges, split/merge, topology-aware
  editing, multi-feature geometric operations. *(Phase 4)*
- Additional languages beyond French — the catalog structure must make these code-free.
- Non-Mercator projections, attribute joins, choropleth wizard, buffering. *(Phase 4)*
- Cloud sync, share links, collaboration; Windows/Linux desktop builds. *(Phase 5)*
- Interactive HTML export *(Phase 5)*; CMYK/ICC print pipeline *(Phase 4)*.

## 3. Architecture Decisions

- **Source of truth is preserved.** `terra-draw` maintains its own internal geometry
  store, but it is wired as a *controlled editor*: every commit writes back into the
  editing layer's `GeoJsonLayer.data` `FeatureCollection`, which remains canonical. The
  existing `syncLayers` path re-renders from the document. terra-draw never becomes a
  parallel source of state (CLAUDE.md invariant).
- **Vector editing is geo-space.** Editing manipulates lng/lat coordinates on the MapLibre
  map via terra-draw's MapLibre adapter; handles reproject to screen automatically. This is
  *distinct* from the Konva canvas-space polygon vertex handles in `AnnotationStage.tsx`,
  which edit annotation objects, not GeoJSON features. The two systems stay separate.
- **History integration via the existing mechanism.** Geometry/attribute edits hint
  `hintHistoryLabel(...)` and reuse the 400 ms coalesce window so drag bursts collapse into
  one undo step — the same contract annotation drags already use (M9). No new history engine.
- **No `.cartoproj` schema change for editing.** Because layers already store a canonical
  `FeatureCollection`, edited geometry round-trips through save/reopen, raster, and
  SVG/PDF export with only `featureCount`/`geometry` housekeeping (allow `'mixed'`).
- **App preferences are not project state.** Language, theme, units, snap defaults, autosave
  interval, and default basemap live in `localStorage` behind a typed schema with a
  defaulting migration — separate from per-project `.cartoproj` settings. Existing scattered
  controls (theme toggle, status-bar snap/units) read from and write to this one store.
- **i18n stays lean.** Use an in-house typed message catalog (keyed records) + a `t()` hook
  and React context rather than a heavy runtime dependency, to protect the bundle budget.
  Number/distance/area/date formatting uses the built-in `Intl` APIs. ICU plurals are
  adopted only where a string genuinely needs them.
- **terra-draw and importer workers are lazy-loaded.** terra-draw loads only when a user
  enters edit mode; importer parsers move to a worker. Both keep the initial bundle within
  the `bundle-budget` gate.
- **Desktop is additive and guarded.** Every desktop-specific path stays behind `isTauri()`
  (`src/app/platform.ts`); the web build keeps full feature parity (CLAUDE.md).

## 4. Milestones

### Milestone 17 — Vector Editing Foundation (controlled editor)

- Install `terra-draw` + its MapLibre adapter; add a lazy-loaded editor module under `src/tools/`.
- Add an **edit mode** to the tool/selection model: enter by choosing an unlocked GeoJSON
  layer to edit; the feature-click → attribute-inspector behavior in `GeoJsonLayers.tsx`
  yields while editing is active.
- Implement the **commit bridge**: terra-draw change events write back into the layer's
  `FeatureCollection` in the document store; `syncLayers` re-renders from canonical state.
- Wire **undo/redo** via `hintHistoryLabel` + the 400 ms coalesce window.
- Honor locked layers (no edit) and visibility.

Acceptance:
- Entering edit mode on a layer shows terra-draw handles over the existing features.
- Moving a vertex updates the document `FeatureCollection`; the rendered layer matches.
- ⌘Z reverts a vertex move as a single step; ⌘⇧Z reapplies it.
- A locked layer cannot be entered for editing.

### Milestone 18 — Feature Editing & Creation

- **Vertex editing** — add / move / delete vertices on line & polygon features; drag whole
  features (point, line, polygon).
- **New-feature drawing** — point / line / polygon tools that append a `Feature` (with empty
  but editable properties) into the active editing layer; update `featureCount`, allow
  `geometry: 'mixed'`.
- **Delete features** from edit mode and via keyboard.
- **Editable attributes** — extend `AttributeInspector` from read-only to add / rename /
  delete / edit feature properties, committing to the document.
- Confirm round-trip through `.cartoproj` save/reopen and raster export.

Acceptance:
- User draws a new polygon into an imported layer; it persists after save/reopen.
- User adds a vertex to a line, deletes another, and drags the whole feature.
- User edits a feature's `name` property and adds a new property; the inspector reflects both.
- Deleting a feature decrements `featureCount` and removes it from the render and export.

### Milestone 19 — Localization (i18n) — French + English

- Add the typed catalog infrastructure: `t()` hook, React context/provider, English base
  catalog, and a locale store wired to preferences (M21).
- Extract all UI strings (tool rail, menus, inspector, dialogs, toasts, status bar,
  keyboard-shortcuts help, recovery/recents) into catalog keys.
- Add a lint/test guard that fails on new hardcoded user-facing strings.
- Author the **French** catalog with reviewed cartographic/editorial terminology.
- Auto-detect locale from the browser; allow a manual override (consumed by M21's modal).
- Route number / distance / area / date formatting through `Intl` (ruler readouts, scale bar).

Acceptance:
- Switching locale to French re-renders the whole UI in French without reload.
- No user-facing English string remains outside the catalog (guard passes).
- Ruler distance and scale-bar text format per the active locale.
- Catalog completeness test: French has a value for every English key.

### Milestone 20 — UI Discoverability (tooltips & help)

- Build a reusable **glass tooltip** component per `design.md` §4: hover + focus trigger,
  open delay, smart placement, a keyboard-shortcut chip, and `aria-describedby` wiring.
- Replace native `title=` tooltips in the tool rail with **name + one-line description +
  shortcut** (all localized).
- Add tooltips to inspector controls, status-bar toggles, the Insert/furniture menu, and
  export options.
- Add a lightweight first-run / "what's this" hint for the core loop (dismissible, persisted).

Acceptance:
- Hovering or focusing any tool shows its localized description and shortcut.
- Tooltips are keyboard-accessible and screen-reader-announced.
- Tooltip strings switch with locale.

### Milestone 21 — Settings Modal & Preferences Store

- Add a typed app-preferences store backed by `localStorage` with a defaulting migration.
- Build the **Settings modal** (⌘,) with groups: Language, Appearance (theme / accent),
  Units (metric / imperial default), Canvas (grid snap defaults, smart guides, spacing),
  Autosave interval, Default basemap, and Reset-to-defaults.
- Migrate existing scattered controls (theme toggle, status-bar snap & units) to read/write
  the same store so app settings have one source of truth.
- Wire the locale override (M19) and tooltip-hint reset into the modal.

Acceptance:
- Opening ⌘, shows the modal; changing language/theme/units takes effect immediately.
- Preferences survive reload; Reset-to-defaults restores them.
- Status-bar snap/units and the theme toggle reflect changes made in the modal and vice-versa.

### Milestone 22 — Importer Workers & Vector SVG Export

- Move TopoJSON / KML / GPX / Shapefile parsing onto a worker thread (parsers are pure and
  worker-ready); keep the lazy per-format loading.
- Extend SVG export so GeoJSON features serialize as **editable vector paths** (projected to
  the export frame) instead of being baked into the basemap raster; keep the existing
  rasterized-vs-PNG diff tolerance.

Acceptance:
- Importing the 10 MB fixture does not block the main thread (UI stays responsive).
- Exported SVG contains real `<path>` elements for imported/edited features, editable in a
  vector editor, and stays within the diff tolerance against the PNG baseline.

### Milestone 23 — Desktop Local Basemap Files

> The Tauri 2 macOS shell is **already shipped** (non-notarized): native open/save +
> export dialogs, HTTP-plugin basemap fetch, native window chrome, and full web parity
> behind `isTauri()` (see `src-tauri/README.md`). M23 adds the one desktop capability the
> shell does not yet have, leaving notarization deferred.

- **Local PMTiles file** basemaps enabled on desktop via the native FS path (resolving the
  web `blob:` save/reopen limitation deferred from M5/M11 — on desktop a stable file path
  is persisted instead of a `blob:` URL).
- Surface local-file selection in the basemap source picker only when `isTauri()`.
- Keep full web parity: the web build still blocks local PMTiles files (unchanged).

Acceptance:
- A local `.pmtiles` file loads as a basemap on desktop and survives save/reopen.
- The web build behaves identically to today (local files still gated off).
- The shell's existing native dialogs / HTTP basemap fetch continue to work.

### Milestone 24 — Offline Regional Basemap Packs (desktop)

- First-run choice to download or bundle a regional basemap pack.
- Pack management: list / add / remove; render from a local pack offline.

Acceptance:
- A fresh desktop install can fetch/bundle a pack and render a basemap with no network.
- Packs persist across launches and are selectable in the basemap source picker.

### Milestone 25 — Resilience, Verification & Stabilization

- **Top-level React error boundary + crash-safe recovery** (pulled forward from the code
  audit). No error boundary exists today, so one render error takes down the whole editor
  and risks unsaved work. Add a boundary that catches render failures, preserves the active
  session, and offers autosave recovery. Slotted last so it wraps the new vector-edit /
  i18n / settings surfaces shipped earlier this phase in one fail-safe net.
- Playwright: vector edit flows (move/add/delete vertex, draw feature, delete, attribute
  edit, undo/redo round-trip), locale switch, settings persistence, tooltip presence, and
  an error-boundary recovery flow.
- Vitest: edit→`FeatureCollection` commit, attribute mutations, i18n catalog completeness,
  preferences defaulting/migration.
- Re-run `bundle-budget` (terra-draw lazy, i18n catalogs split, importer worker).
- Performance: editing a feature in the 10 MB layer stays within PRD §7 interaction targets.

Acceptance:
- All Phase 3 acceptance tests pass.
- Bundle budget holds (or any raise is documented with rationale, as in M12).
- Editing interactions on the 10 MB fixture stay at target frame rate.

## 5. Technical Spikes

- **terra-draw ↔ document binding:** confirm the cleanest commit bridge (terra-draw change
  events → store action → `syncLayers`) without feedback loops when the store re-renders the
  layer the editor is bound to. Validate undo/redo coalescing on a multi-vertex drag.
- **Edit-mode coexistence with deck.gl / heatmap layers:** verify editing a `vector` layer
  while a sibling `heatmap` layer is interleaved doesn't disturb the overlay.
- **i18n approach sizing:** prototype the in-house typed catalog vs a minimal library;
  measure bundle delta and confirm French strings don't break the liquid-glass layout
  (longer strings, truncation, tooltip width).
- **SVG vector-path fidelity:** export a départements layer as vector paths and check
  coordinate precision, file size, and editor compatibility against the diff tolerance.
- **Desktop local PMTiles persistence:** the shell already ships; the open unknown is how a
  user-picked local `.pmtiles` file persists across save/reopen. Confirm a stable native
  file *path* (not a `blob:` URL) survives in `.cartoproj`/recents on desktop, and that the
  web build still gracefully blocks local files. Notarization stays deferred (Phase 5).

## 6. Test Plan

- Unit: feature geometry commit, attribute add/rename/delete/edit, `featureCount`/`geometry`
  housekeeping, i18n catalog completeness + no-hardcoded-string guard, preferences schema
  defaulting/migration, locale-aware formatters.
- Component: edit-mode toggle, attribute inspector editing, tooltip rendering + a11y,
  settings modal groups and persistence.
- Playwright: vector edit round-trip (draw → save → reopen), undo/redo of edits, locale
  switch, settings persistence across reload, tooltip presence, desktop smoke (where runnable).
- Visual: SVG vector-path export diff against the PNG baseline within tolerance.
- Performance: feature edit interaction on the 10 MB fixture.

## 7. Risks and Mitigations

- **terra-draw owning a parallel state:** enforce the controlled-editor pattern — commit to
  `FeatureCollection`, re-render from the document; add a test that the document, not the
  editor, is authoritative after an edit.
- **Undo/redo gaps on geometry edits:** reuse the existing `hintHistoryLabel` + coalesce
  contract from day one rather than retrofitting; cover with a round-trip test.
- **i18n bundle/layout regressions:** lean catalog + lazy French; spike layout with French
  strings before extracting everything; bundle-budget gate.
- **Hardcoded strings reappearing:** lint/test guard fails CI on new user-facing literals.
- **Settings migration breaking existing users:** typed schema + defaulting migration with a
  unit test, mirroring the `.cartoproj` migration approach.
- **Desktop local-file persistence:** a `blob:` URL can't survive save/reopen (the original
  M5/M11 blocker); persist a native file path instead and verify round-trip (see the desktop
  local-PMTiles spike). Signing/notarization stays deferred to Phase 5, so it is not a Phase
  3 release blocker.
- **Editing performance on large layers:** measure on the 10 MB fixture; if needed, scope
  edit handles to features in view.

## 8. Definition of Done

Phase 3 is done when a user can:

1. Open an imported GeoJSON layer, move/add/delete its vertices, drag features, draw new
   features, and edit feature attributes — with working undo/redo.
2. Save, reopen, and export (raster + vector SVG) those edits faithfully.
3. Switch the entire UI between English and French, with locale auto-detected and overridable.
4. Discover what every tool does via accessible, localized tooltips.
5. Adjust language, appearance, units, canvas snapping, autosave, and default basemap in one
   Settings modal, persisted across sessions.
6. On the existing (non-notarized) macOS desktop app, additionally load a **local PMTiles
   file** as a basemap and use **offline basemap packs** — on top of the native dialogs and
   HTTP basemap fetch the shell already provides.
7. Recover gracefully from a render error: the editor shows an error boundary instead of a
   blank crash, and the active session is preserved / restorable from autosave.

All Phase 3 acceptance tests must pass, the bundle budget must hold (or any raise documented),
and the `.cartoproj` source-of-truth invariant must remain intact — verified by a test that
the document, not terra-draw, is authoritative after editing.
