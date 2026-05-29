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

### Basemap and data
- Open an interactive basemap (OSM-derived PMTiles via Protomaps) — no tile server or API key required
- Switch between four built-in styles: Editorial Light, Editorial Dark, Minimal Grey, Print B&W
- Provide a custom MapLibre style URL as the basemap source
- Toggle individual basemap sub-layers: roads, labels, water, landuse, buildings, boundaries
- Import **GeoJSON, TopoJSON, KML, GPX, and Shapefile** — drag-drop or file picker
- Inspect feature attributes; reorder, show/hide, lock, rename, and delete layers
- Place GeoJSON layers as standard vector or switch them to a **GPU-accelerated heatmap** (deck.gl)

### Annotations
- **Text** — labels with font choice, size, color, and halo
- **Rectangle and ellipse** — filled or stroked shapes
- **Line / arrow** — segments with dashed stroke and arrowheads
- **Polygon** — closed shape with hatch and pattern fill options
- **Point pin** — colored map pin anchored to a geographic location
- **Image** — place a PNG, JPEG, or SVG raster anywhere on the canvas
- **Ruler / measurement** — measure distances and areas on the map

All annotation types support fill, stroke, opacity, drop shadow, blend modes (normal / multiply / screen / overlay), and geo vs. canvas anchoring ("Pin to map" / "Pin to canvas").

### Map furniture
- **Title block and source credit**
- **Scale bar** — snaps to round distances and tracks map scale
- **North arrow** — follows map bearing
- **Legend builder** — manually editable swatches linked to layer styles

### Canvas tools
- Marquee multi-select with shift/cmd/alt modifiers
- Group and ungroup objects (⌘G / ⌘⇧G)
- Smart guides — edge and center alignment cues during drag
- Grid snap — toggleable with configurable spacing
- Undo/redo with 100+ meaningful document steps (⌘Z / ⌘⇧Z)

### Project workflow
- Multi-project tab bar — open several maps at once, each with its own autosave session
- Save and reopen `.cartoproj` project files (plain JSON); recent projects menu
- Browser autosave every 10 seconds (IndexedDB), with per-tab draft recovery on reload
- Dirty-document guards on New, Open, Close, and restore

### Export
- **PNG and JPEG** — 1×, 2×, or custom scale; white or transparent background; JPEG quality slider
- **SVG** — annotations and map furniture export as editable vector objects; basemap and imported data layers are embedded as a raster image
- **PDF** — raster-in-PDF sized to the composition frame

### Desktop
- Native macOS window via Tauri 2, with full feature parity with the web build

---

## Current limitations

The following are known gaps, not bugs:

- **Local PMTiles file as basemap not supported** — `blob:` URLs cannot survive project save/reopen; use a hosted PMTiles or tile URL instead
- **Imported data layers are rasterized in SVG export** — GeoJSON/Shapefile/etc. features are embedded as a raster image in the SVG, not as editable vector paths; annotations and furniture remain fully editable
- **PDF export is raster-only** — the PDF embeds the composition as a raster image; editable-vector PDF is post-v1
- **Large-file importers run on the main thread** — Shapefile and TopoJSON parsers are not yet offloaded to a worker; very large files may briefly block the UI
- **Desktop build has no native file dialogs** — the macOS app uses the browser File System Access API fallback; native open/save dialogs and drag-drop import are planned
- **Desktop build is unsigned** — the Tauri app is not yet signed or notarized; macOS Gatekeeper will flag it
- **No offline basemap packs** — both web and desktop fetch tiles remotely; regional offline packs are planned for a later desktop release
- **macOS only for desktop** — Windows and Linux builds are on the roadmap
- **No GIS analysis** — attribute joins, choropleth wizard, buffers, and geocoding are post-v1
- **No non-Mercator projections** — only Web Mercator via MapLibre; Robinson, Equal Earth, and similar editorial projections are roadmap
- **No interactive HTML export, cloud sync, or collaboration**

---

## Roadmap

**Near-term** — native macOS file dialogs and notarized build, worker-threaded import parsers, GeoJSON-as-editable-vector-paths in SVG, offline regional basemap packs for desktop.

**Post-v1** — non-Mercator editorial projections (Robinson, Equal Earth, Winkel Tripel) via d3-geo, GIS-style attribute joins and choropleth wizard, proportional symbols, interactive HTML export, editable-vector PDF, cloud project sync, real-time collaboration, Windows and Linux desktop builds, templates gallery.

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
  import/     GeoJSON, TopoJSON, KML, GPX, Shapefile parsers
  export/     png.ts, jpeg.ts, svg.ts, pdf.ts
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
