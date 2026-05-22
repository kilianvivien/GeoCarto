# GeoCarto — Implementation Progress

Tracks delivery against `docs-mocks/PRD.md` and `docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md`.
Status legend: ✅ done · 🟡 in progress · ⬜ not started.

## Phase 1 — Browser-based map editor

Goal: a user can open a map editor, import GeoJSON, annotate, save/reopen a
project, and export a high-DPI raster from a fixed composition frame.

### Milestone 1 — Project Foundation ✅

- ✅ Vite + React + TypeScript (strict) project structure
- ✅ Tailwind v4, Lucide icons
- ✅ MapLibre, PMTiles, Konva/react-konva, Zustand, Immer installed
- ✅ Vitest + Playwright configured
- ✅ PRD-mirrored `src/` folders (`app`, `canvas`, `layers`, `tools`, `style`,
  `import`, `export`, `project`, `state`, `ui`, `basemap`)
- ✅ lint / typecheck / test scripts
- Note: shadcn baseline intentionally deferred — the design system is custom
  liquid-glass; no shadcn component is consumed yet.

### Milestone 2 — Map Canvas and Basemap ✅

- ✅ `MapView` with MapLibre init and viewport state sync
- ✅ PMTiles protocol registered once at app root
- ✅ Default editorial basemap (remote Protomaps demo PMTiles, light/dark flavors)
- ✅ Pan/zoom, zoom + coordinate display, attribution
- ✅ Visible export frame overlay
- ✅ macOS liquid-glass app shell (titlebar, tool rail, inspector, status bar);
  inner inspector panes are stubs
- ✅ Light/dark theme with basemap restyle

### Milestone 3 — Document Model and Layers ✅

- ✅ `.cartoproj` schema (metadata, viewport, export frame, layers, styles)
- ✅ Document store actions: add, rename, reorder, lock, hide, delete, select
- ✅ GeoJSON import (file picker + drag-drop), with toast feedback
- ✅ Render imported GeoJSON as MapLibre sources/layers
- ✅ Layer panel + attribute inspector
- Note: annotation objects join the `.cartoproj` schema in Milestone 4.

### Milestone 4 — Annotation Tools ⬜

- ⬜ Selection/move tool
- ⬜ Text, rectangle, ellipse, line/arrow, polygon, point pin tools
- ⬜ Inspector controls: fill, stroke, opacity, text size/color, pin color/icon
- ⬜ Object lock/hide behavior
- ⬜ Keyboard shortcuts (V/T/R/P, delete)

### Milestone 5 — Save, Autosave, and Export ⬜

- ⬜ Save/open plain `.cartoproj` JSON
- ⬜ Browser autosave every 10s after changes
- ⬜ Recovery prompt for autosaved drafts
- ⬜ PNG/JPEG export from the export frame at 1x / 2x / custom scale
- ⬜ Basemap + GeoJSON + annotations included in raster export

### Milestone 6 — Verification and Stabilization ⬜

- ⬜ Playwright flows: first run, import, annotation, round-trip, autosave, export
- ⬜ Unit tests: schema migration/defaulting, layer ordering, annotation updates
- ⬜ Reference + medium performance datasets
- ⬜ Performance measurement (pan/zoom, import, export, memory)
- ⬜ Fix usability blockers

## Beyond Phase 1 (PRD roadmap) ⬜

- ⬜ v1 editorial work
- ⬜ Tauri native macOS shell (will provide a native menu bar)
- ⬜ SVG/PDF export
- ⬜ Multi-format import (TopoJSON, KML, GPX, Shapefile, GeoPackage)
- ⬜ d3-geo projection pipeline beyond Web Mercator
- ⬜ Choropleth wizard, joins, spatial analysis
