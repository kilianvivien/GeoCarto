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

## Security notes

- `identifier` is `com.geocarto.app` — change before publishing under another brand.
- `app.security.csp` is `null` (no enforced CSP) to keep web⇄desktop parity while
  MapLibre pulls cross-origin tiles/glyphs/sprites and spawns `blob:` workers.
  Tighten to a scoped policy once the allowed origins are pinned.
- Capability scopes are deliberately narrow: `fs` is limited to `$HOME/**`
  (user-chosen save paths) and `http` to `https://demo-bucket.protomaps.com/*`
  (the default basemap archive only). Custom user PMTiles URLs still go through
  the browser fetch path and work whenever that host serves CORS — same as web.
