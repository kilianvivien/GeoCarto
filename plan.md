# GeoCarto — Implementation Progress

Tracks delivery against `docs-mocks/PRD.md` and `docs-mocks/PHASE1_IMPLEMENTATION_PLAN.md`.
Status legend: ✅ done · 🟡 in progress · ⬜ not started.

GeoCarto is a "Figma for maps" — an open-canvas cartography editor that runs in
the browser (Phase 1) and as a native macOS app (v1). Three delivery phases:
**Phase 1 / MVP exit hardening**, **Phase 2 / v1 Editorial**, and
**Post-v1 Roadmap**.

---

## Phase 1 / MVP — browser core loop 🟡 Exit hardening

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

### Milestone 4 — Annotation Tools 🟡

- ✅ Konva annotation stage, camera-synced to MapView
- ✅ Selection/move tool with Figma-style transformer handles
- ✅ Text, rectangle, ellipse, line/arrow, polygon, point pin tools
- ✅ Inspector controls: fill, stroke, opacity, text size/color, pin color/icon
- ✅ Font choice from a small bundled set
- ✅ Object lock/hide; geo vs canvas anchoring ("Pin to map" / "Pin to canvas")
- 🟡 Phase 1 tool gate: enabled tools are Move, Line/Pen, Rectangle, Ellipse,
      Polygon, Text, Pin, Arrow; Phase 2 tools are disabled/marked.
- 🟡 Keyboard shortcuts: `P` Line/Pen, `G` Polygon, delete selected; Phase 2
      shortcuts must not activate inert tools.
- Note: annotations are serializable in `.cartoproj`; save/autosave/export lands in Milestone 5.

### Milestone 5 — Save, Autosave, and Export 🟡

- ✅ Save/open plain `.cartoproj` JSON (File System Access API + download/upload fallback)
- ✅ Browser autosave every 10s (IndexedDB) + recovery prompt for autosaved drafts
- ✅ PNG/JPEG export from the export frame at 1x / 2x / custom scale
- ✅ White or transparent background; JPEG quality slider
- ✅ Basemap + GeoJSON + annotations composited into the raster export
- 🟡 Single-document New/Open/Restore now require dirty-document safety prompts.
- 🟡 Local PMTiles file basemaps are disabled for Phase 1 web because `blob:`
      URLs cannot survive save/reopen.
- 🟡 Static PDF basemap export remains unsupported until Phase 2 export hardening.

### Milestone 6 — Verification and Stabilization 🟡

- ✅ Playwright flows: first run, import, annotation, round-trip, autosave, export
- ✅ Unit tests: schema migration/defaulting, layer ordering, annotation updates
- 🟡 Export tests cover PNG/JPEG/custom scale/transparent options and basic
      output signatures; visual fidelity/pixel diff still needs a stronger harness.
- 🟡 Performance smoke records cold start/import/export and enforces broad PRD
      thresholds; dataset realism still needs a true 10 MB fixture.
- 🟡 Production build passes but emits a large initial JS chunk warning; bundle
      splitting remains a Phase 1 exit-hardening task.

---

## Phase 1 Exit Audit & Hardening 🟡

Acceptance before moving fully into Phase 2:

- ✅ No enabled UI control is inert. Ruler, locked-canvas Pan, Marquee, Paint,
      Image, Legend, Comment, Undo, Redo, Snap, and Share are disabled/marked
      as Phase 2 until implemented.
- ✅ GeoJSON layer style controls are exposed in the inspector and persisted in
      `.cartoproj`.
- ✅ Locked layers cannot be renamed, deleted, reordered, or restyled.
- ✅ New/Open/Autosave Restore prompt before discarding dirty work.
- ✅ Local PMTiles file selection is blocked in Phase 1 web; use remote PMTiles
      URLs or built-in basemaps for persisted projects.
- 🟡 Export acceptance should add visual/pixel comparisons against the visible
      composition frame for basemap + GeoJSON + annotations.
- 🟡 Performance acceptance should use a realistic 10 MB GeoJSON fixture and
      enforce cold start, import, pan/zoom, drag, export, and memory thresholds.
- 🟡 Bundle hardening should code-split heavy MapLibre/Konva/export paths or set
      an explicit accepted bundle budget.

---

## Phase 2 / v1 Editorial — production-grade editorial tool

### Project & Document Workflow ⬜

- ⬜ Multi-project sessions/tabs:
  - ⬜ `ProjectSession { id, project, file, dirty, autosaveKey, title, lastActiveAt }`
  - ⬜ `activeSessionId`
  - ⬜ New/Open creates or switches tabs; Close prompts on unsaved changes
  - ⬜ Autosave is per-project/per-tab rather than one global current draft
- ⬜ Recent projects where browser/native capabilities allow it
- ⬜ Undo/redo with ≥100 meaningful document steps
- ⬜ Pixel/grid snap, ruler/measurement tool, and locked-canvas pan tool
- ⬜ Share, comments, image placement, and legend builder workflows

### Basemap sources & styling 🟡

The basemap must be **user-selectable**, from either an online source or a custom
base — this is a core editorial requirement.

- ✅ Built-in style presets: Editorial Light, Editorial Dark, Minimal Grey, Print B&W
- 🟡 **Basemap source picker** — partial Phase 1 prototype:
  - ✅ Online: hosted Protomaps PMTiles / standard tile or style URLs
  - ✅ Custom: user-supplied MapLibre style URL
  - 🟡 Custom: PMTiles URL supported; local PMTiles file deferred because
        persisted `blob:` URLs break save/reopen
  - ⬜ Offline: bundled / downloaded regional basemap packs (desktop)
- ⬜ Toggle basemap sub-layers: roads, labels, water, landuse, buildings, boundaries
- 🟡 Persist the chosen basemap source + style in the `.cartoproj` document

### Richer annotation & styling ⬜

- ⬜ deck.gl data layers interleaved via `MapboxOverlay`
- ⬜ Dashed lines, arrowheads, halos, shadows, patterns, blend modes
- ⬜ Grouped objects; smart guides (edge/center) and pixel/grid snap
- ⬜ Title block, source credit, scale bar, north arrow
- ⬜ Manually editable legend builder

### Import & export ⬜

- ⬜ Import TopoJSON, KML, GPX, Shapefile
- ⬜ SVG export — technical spike first, then editable vector serializer
      (supported objects stay editable in Illustrator/Figma; fallbacks documented)

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
