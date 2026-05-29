# src-tauri — GeoCarto desktop shell (Tauri 2)

A thin native wrapper around the same web frontend. The `.cartoproj` document
stays the single source of truth; the Rust side only provides the host
capabilities WKWebView lacks. **The web build must keep full feature parity** —
every desktop-specific code path in `src/` is additive and guarded by
`isTauri()` (see [`src/app/platform.ts`](../src/app/platform.ts)).

## Commands

- `npm run tauri:dev` — launch the desktop app against the Vite dev server.
- `npm run tauri:build` — produce a bundled `.app`/`.dmg` (runs `npm run build`
  first via `beforeBuildCommand`).

Requires the Rust toolchain (`rustc`/`cargo`). Signing & notarization are a
later v1 milestone and are intentionally not configured here.

## How desktop differs from web (and why)

| Concern | Web | Desktop | Why |
| --- | --- | --- | --- |
| Project save / open | File System Access API, else `<a download>` | `plugin-dialog` + `plugin-fs` (path in `DocumentFileBinding.path`) | WKWebView has no FSA and anchor downloads are unreliable |
| Export (PNG/JPEG/SVG/PDF) | `<a download>` | native save dialog + `plugin-fs.writeFile` | same |
| Default basemap PMTiles | same-origin proxy (`/__geocarto_basemap/...`, Vite + Vercel rewrite) | fetched from the CDN through `plugin-http` (native request) | the Protomaps demo bucket sends **no** `Access-Control-Allow-Origin`, so a `fetch` from `tauri://localhost` is CORS-blocked. The native request bypasses CORS. See `TauriHttpSource` in [`src/basemap/pmtiles.ts`](../src/basemap/pmtiles.ts) |
| Glyphs / sprites | `protomaps.github.io` (CORS `*`) | identical — no change needed | GitHub Pages serves permissive CORS |
| Window chrome | full-bleed glass over the `--wallpaper` gradient | full-bleed glass over native macOS **vibrancy** (transparent window) | one unified window instead of a card-in-a-window. See below. |

## Window chrome (single native window)

The web and desktop builds share one full-bleed layout (`AppShell` fills the
viewport — no padded floating card). `index.html` tags `<html data-tauri>` before
the bundle loads (Tauri injects `__TAURI_INTERNALS__` early), and a couple of CSS
rules + the title bar adapt from there:

- **Overlay title bar** — `titleBarStyle: "Overlay"` + `hiddenTitle: true` drop the
  native title strip but keep the real traffic lights floating over the top-left.
  `TitleBar` is a `data-tauri-drag-region` (inert on the web) and insets its content
  by `--titlebar-leading` (12 px web → 84 px under `html[data-tauri]`) so the
  centered title clears those lights. The old fake traffic-light dots are gone.
- **Native vibrancy** — the window is `transparent: true` with a `sidebar`
  `windowEffects` material, and `html[data-tauri] body` is transparent so the
  material shows through the translucent glass chrome. Requires the
  `macos-private-api` Cargo feature (see Security notes).

## Security notes

- `transparent: true` (for vibrancy) needs `app.macOSPrivateApi: true` + the
  `tauri` crate's `macos-private-api` feature. This uses a **private macOS API**,
  which makes the bundle ineligible for the Mac App Store. That's fine while
  distribution is a direct `.dmg`; drop vibrancy (or switch to the `window-vibrancy`
  crate's public path) if App Store submission becomes a goal.

- `identifier` is `com.geocarto.app` — change before publishing under another brand.
- `app.security.csp` is `null` (no enforced CSP) to keep web⇄desktop parity while
  MapLibre pulls cross-origin tiles/glyphs/sprites and spawns `blob:` workers.
  Tighten to a scoped policy once the allowed origins are pinned.
- Capability scopes are deliberately narrow: `fs` is limited to `$HOME/**`
  (user-chosen save paths) and `http` to `https://demo-bucket.protomaps.com/*`
  (the default basemap archive only). Custom user PMTiles URLs still go through
  the browser fetch path and work whenever that host serves CORS — same as web.
