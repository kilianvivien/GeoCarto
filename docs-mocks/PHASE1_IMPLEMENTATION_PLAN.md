# Phase 1 Implementation Plan — GeoCarto

## 1. Goal

Phase 1 proves the core product loop: a user can open a browser-based map editor, import GeoJSON, add simple annotations, save/reopen a project, and export a high-DPI PNG/JPEG from a fixed composition frame.

This phase should feel like a usable prototype, not a technology demo. It does not need desktop packaging, SVG/PDF export, multi-format import, advanced GIS tools, collaboration, or full offline basemap packs.

## 2. Scope

### In scope

- Vite + React + TypeScript app shell.
- MapLibre map viewport with one default editorial basemap style.
- PMTiles protocol wiring, using either a small local sample or static remote sample for development.
- Canonical `.cartoproj` document model.
- Zustand state stores for document, viewport, selection, and UI.
- GeoJSON import as map layers.
- Basic attribute inspection for imported GeoJSON.
- Layer panel with reorder, visibility, lock, rename, and delete.
- Annotation tools: select/move, text, rectangle, ellipse, line/arrow, polygon, and point pin.
- Basic styling: fill, stroke, opacity, text size, text color, and simple icon/pin color.
- Export frame visible on canvas.
- PNG and JPEG export at 1x, 2x, and custom scale.
- Save, open, and autosave recovery in the browser.
- Playwright acceptance tests for the core loop.

### Out of scope

- Tauri desktop shell, signing, notarization, and native file dialogs.
- SVG/PDF export, except for a short technical spike if time allows.
- TopoJSON, KML, GPX, Shapefile, and GeoPackage import.
- Choropleth wizard, joins, buffers, geocoding, or spatial analysis.
- Comments, cloud sync, accounts, sharing, and collaboration.
- Custom font upload and print-house CMYK workflows.

## 3. Architecture Decisions

- Use the project document as the source of truth. MapLibre, Konva, and export code render from this model rather than owning independent state.
- Keep Phase 1 projection support to Web Mercator through MapLibre. Do not build the d3-geo projection pipeline yet.
- Use MapLibre for basemap and imported GeoJSON rendering.
- Use Konva for editable annotation objects and transformer handles.
- Keep HTML overlays minimal in Phase 1; use them only if text quality inside Konva is not acceptable.
- Use a fixed export frame so export behavior is predictable before infinite-canvas complexity grows.
- Store `.cartoproj` as plain JSON in Phase 1. Zip bundles with embedded assets wait until v1.

## 4. Milestones

### Milestone 1 — Project Foundation

- Create Vite React TypeScript project structure.
- Add Tailwind, shadcn/ui baseline components, and Lucide icons.
- Add MapLibre, PMTiles, Konva/react-konva, Zustand, Immer, Vitest, and Playwright.
- Establish folders from the PRD: `app`, `canvas`, `layers`, `tools`, `project`, `state`, `export`, `import`, `ui`, and `basemap`.
- Add lint/typecheck/test scripts.

Acceptance:
- App starts locally.
- A blank workspace shell renders without console errors.
- Typecheck and unit test scripts run in CI-compatible form.

### Milestone 2 — Map Canvas and Basemap

- Implement `MapView` with MapLibre initialization and viewport state sync.
- Register PMTiles protocol once at app root.
- Load the default basemap style.
- Add zoom, pan, current zoom display, and attribution.
- Add the visible export frame overlay.

Acceptance:
- User opens the app and sees the default basemap.
- Pan and zoom are smooth on the reference machine.
- Export frame remains visually stable while navigating.

### Milestone 3 — Document Model and Layers

- Define `.cartoproj` schema for project metadata, viewport, export frame, map layers, annotation objects, and styles.
- Implement document store actions: create, update, reorder, lock, hide, delete, select.
- Add GeoJSON import from file picker and drag-drop.
- Render imported GeoJSON as MapLibre sources/layers.
- Add layer panel and basic attribute inspector.

Acceptance:
- User imports a GeoJSON file and sees it on the map.
- User can inspect feature properties.
- User can hide, lock, rename, delete, and reorder imported layers.

### Milestone 4 — Annotation Tools

- Implement selection and move tool.
- Implement text, rectangle, ellipse, line/arrow, polygon, and point pin tools.
- Add inspector controls for fill, stroke, opacity, text size, text color, and pin color/icon.
- Add object locking/hiding behavior.
- Add basic keyboard shortcuts: `V` select, `T` text, `R` rectangle, `P` polygon, delete selected object.

Acceptance:
- User can add and edit all Phase 1 annotation types.
- User can select, move, restyle, hide, lock, and delete annotations.
- Locked objects cannot be moved or edited.

### Milestone 5 — Save, Autosave, and Export

- Implement save/open for plain `.cartoproj` JSON.
- Implement browser autosave every 10 seconds after document changes.
- Add recovery prompt when an autosaved draft exists.
- Implement PNG/JPEG export from the export frame at 1x, 2x, and custom scale.
- Include basemap, imported GeoJSON, and annotations in raster export.

Acceptance:
- User can save a project, reopen it, and see matching layers, annotations, viewport, and styles.
- User can recover from autosave after reload.
- Exported PNG/JPEG matches the visible export frame within visual tolerance.

### Milestone 6 — Verification and Stabilization

- Add Playwright flows for first run, GeoJSON import, annotation creation, project round-trip, autosave recovery, and PNG export.
- Add unit tests for project schema migration/defaulting, layer ordering, and annotation state updates.
- Add a small reference dataset and a medium Phase 1 performance dataset.
- Measure pan/zoom, import time, export time, and memory.
- Fix usability blockers discovered by testing.

Acceptance:
- All Phase 1 acceptance tests pass.
- 10 MB GeoJSON imports in under 3 seconds on the reference machine.
- Reference project pans/zooms at the target frame rate.
- 4000x3000 @2x PNG export completes in under 5 seconds.

## 5. Technical Spikes

- **Raster export composition:** verify the best way to combine MapLibre canvas and Konva stage into one high-DPI export without CORS or scaling artifacts.
- **SVG export feasibility:** optional Phase 1 spike only. Export one basemap slice, one GeoJSON layer, and basic annotations to SVG; document what remains editable and what breaks.
- **Text rendering:** compare Konva text export quality against HTML overlay text for labels and title/source blocks.
- **PMTiles dev data:** choose a small sample dataset that is light enough for the repo or document the remote/static asset setup.

## 6. Test Plan

- Unit tests for document actions, schema defaults, import normalization, layer order, and export-frame math.
- Component tests for layer panel, inspector controls, toolbar state, and recovery prompt.
- Playwright tests for first-run flow, import flow, annotation flow, save/open round-trip, autosave recovery, and PNG export.
- Visual checks for exported raster output against the visible export frame.
- Performance smoke test with fixed datasets.

## 7. Risks and Mitigations

- **MapLibre + Konva export mismatch:** prioritize the raster export spike before building many annotation features.
- **State duplication between renderers:** keep the document store authoritative and make renderers disposable projections of state.
- **GeoJSON import performance:** start with a size cap and add worker parsing only if the Phase 1 dataset misses target.
- **Basemap asset weight:** use a tiny dev PMTiles sample or documented remote static asset before committing to offline packs.
- **Feature creep from v1 goals:** keep SVG, desktop, advanced imports, and projection work behind explicit milestone gates.

## 8. Definition of Done

Phase 1 is done when a non-technical user can:

1. Open the web app.
2. See a clean map.
3. Import a GeoJSON file.
4. Add and style a few annotations.
5. Save the project.
6. Reopen the project and see the same result.
7. Export a PNG/JPEG suitable for an article draft or presentation.

All Phase 1 acceptance tests must pass, and any known export, data-loss, or crash-recovery issues must be documented before moving to v1 editorial work.
