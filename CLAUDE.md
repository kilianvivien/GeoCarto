# GeoCarto

A visual-first cartography app — an open-canvas map editor for editorial and casual map makers. Browser-based (Phase 1), native macOS later (Tauri). Open a basemap, annotate it on an open canvas, export print-ready images.

## Stack

- Vite 7 + React 19 + TypeScript (strict)
- Tailwind v4 + shadcn/ui (new-york, neutral) + lucide-react
- Vitest (unit) + Playwright (e2e)
- Planned per milestone: MapLibre GL + PMTiles (basemap), Konva (annotations),
  deck.gl (data layers), terra-draw (drawing), Zustand + Immer (state)

## Commands

- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck + production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright e2e tests

## Layout

Source folders under `src/` mirror the app domains — `app`, `canvas`, `layers`,
`tools`, `style`, `import`, `export`, `project`, `state`, `ui`, `basemap`.
Empty domain folders carry a README describing their future role.

The `@/` alias maps to `src/`.

## Conventions

- The project document (`.cartoproj`) is the source of truth. MapLibre, Konva, and
  export code render from this model — they do not own independent state.
- Web Mercator only for now. Non-GeoJSON import stays behind its milestone gate.
- The app ships as both a web build and a Tauri 2 desktop app (`src-tauri/`). The
  web build must keep full feature parity — every desktop-specific path is additive
  and guarded by `isTauri()` (`src/app/platform.ts`). See `src-tauri/README.md` for
  the platform differences (file dialogs, basemap fetch via the HTTP plugin).
