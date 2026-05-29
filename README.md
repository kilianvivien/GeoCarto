<p align="center">
  <img src="resources/iconset/GeoCarto_icon_1024.png" width="120" alt="GeoCarto icon" />
</p>

<h1 align="center">GeoCarto</h1>

<p align="center">
  A visual map editor for editorial and casual map makers.<br/>
  Open a basemap, import your data, annotate freely, export a print-ready image.
</p>

---

![GeoCarto screenshot](resources/demo.png)

---

## What GeoCarto is

GeoCarto is a canvas-based map editor built for people who need good-looking maps without the complexity of a GIS. You get an interactive basemap, a set of drawing and annotation tools, and a direct path to a high-resolution export — all in a single window, in the browser or as a native macOS app.

The target users are journalists, teachers, designers, and anyone who today falls back to Illustrator or a constrained online tool to make a map that looks the way they want.

---

## What you can do today (v0.1.0)

### Map and data
- Open an interactive basemap powered by MapLibre GL and OSM-derived PMTiles — no tile server or API key required
- Import a **GeoJSON** file (drag-drop or file picker) as an editable map layer
- Inspect feature attributes in the layer panel
- Reorder, show/hide, lock, rename, and delete layers

### Annotations
- **Text** — place and style text labels anywhere on the canvas
- **Rectangle and ellipse** — filled or stroked shapes
- **Line / arrow** — straight segments with optional arrowhead
- **Polygon** — closed filled shape
- **Point pin** — colored map pin anchored to a location

### Styling
- Fill color, stroke color, stroke width, and opacity for all shapes
- Text size, text color, and basic font choice for text objects
- Pin color for point pins

### Project and export
- Save and reopen a `.cartoproj` project file (plain JSON)
- Browser autosave every 10 seconds, with draft recovery on reload
- Export the **export frame** as PNG or JPEG at 1×, 2×, or a custom scale factor

### Desktop
- Native macOS window via Tauri 2, with full feature parity with the web build

---

## Current limitations

GeoCarto is at v0.1.0. The following are known gaps, not bugs:

- **No undo/redo** — changes cannot be stepped back; save often
- **GeoJSON only** — TopoJSON, KML, GPX, and Shapefile import are not yet supported
- **No SVG or PDF export** — only PNG and JPEG are available
- **No basemap style switching** — one built-in editorial style; custom MapLibre style JSON import is not yet supported
- **No sub-layer toggles** — roads, labels, water, and buildings cannot be turned off individually
- **No advanced annotation styling** — no dashed lines, arrowheads beyond basic, halos, shadows, blend modes, or grouped objects
- **No map decorations** — no title block, north arrow, scale bar, or legend builder
- **No smart guides or snapping** — objects do not snap to each other or to a grid
- **No keyboard shortcuts beyond basics** — `V` select, `T` text, `R` rectangle, `P` polygon, Delete to remove
- **Offline desktop basemap is limited** — the macOS app fetches tiles remotely; regional offline packs are a v1 feature
- **macOS only for desktop** — Windows and Linux desktop builds are on the roadmap

---

## Roadmap

**v1 Editorial** — undo/redo (100+ steps), built-in style presets, sub-layer toggles, custom basemap style import, richer annotation styling (dash, halo, shadows, blend modes, grouping), title block, north arrow, scale bar, legend builder, SVG export, more import formats (TopoJSON, KML, GPX, Shapefile), smart guides and snapping, signed and notarized macOS build with native file dialogs and offline basemap packs.

**Post-v1** — non-Mercator editorial projections, GIS-style attribute joins and choropleth wizard, proportional symbols, interactive HTML export, PDF export, cloud project sync, real-time collaboration, Windows and Linux desktop builds.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | React 19 + TypeScript + Vite 7 |
| Desktop | Tauri 2 (macOS) |
| Basemap | MapLibre GL JS v5 + PMTiles |
| Data layers | deck.gl (interleaved via `MapboxOverlay`) |
| Annotation canvas | Konva.js |
| Drawing | terra-draw |
| State | Zustand + Immer |
| UI | shadcn/ui (new-york) + Tailwind v4 + Lucide |
| Testing | Vitest + Playwright |

---

## Getting started

### Prerequisites

- Node.js 20+
- Rust + Cargo (desktop build only)

### Web app

```bash
git clone https://github.com/kilianvivien/geocarto.git
cd geocarto
npm install
npm run dev          # http://localhost:5173
```

### macOS desktop app

```bash
npm run tauri dev    # development build with hot-reload
npm run tauri build  # production .app bundle
```

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server at `http://localhost:5173` |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |

---

## Project structure

```
src/
  app/        App shell, routing, Tauri bridge
  canvas/     MapView, AnnotationStage, DeckOverlay, coordinates, exportFrame
  tools/      One module per tool
  layers/     Layer model, ordering, visibility, locking
  style/       Built-in presets, style editor
  import/     GeoJSON parser (v1 adds TopoJSON, KML, GPX, Shapefile)
  export/     png.ts, jpeg.ts (svg.ts and pdf.ts in later milestones)
  project/    .cartoproj schema, load/save, autosave
  state/      Zustand stores — document, selection, viewport, ui
  ui/         shadcn components, panels, inspector
  basemap/    Protomaps integration, style presets
src-tauri/    Tauri 2 Rust shell
public/       Sample PMTiles for development
docs-mocks/   PRD, implementation plan, design system, UI mock
```

---

## Contributing

The project is in early development. Issues and pull requests are welcome — please open an issue first for significant changes so we can align on scope before you invest time in an implementation.

---

## License

MIT — see [LICENSE](LICENSE).
