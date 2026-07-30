# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted. Put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.

Existing helpers:

- `scripts/smoke.mjs` — headless Chromium: default card visibility, toggling
  every card via the Cards menu, canvases mounting for the two 3D cards,
  drag-to-reposition, resize, `localStorage` persistence across reload, and
  layout reset. `--screenshot <path>`, `--preview` (prod build on :4173).
  Any console/page error → exit code 2.
- `scripts/snap.mjs` — single debug screenshot. Flags: `--out <path>`
  (required), `--show <cardId>` / `--hide <cardId>` (repeatable), `--width`,
  `--height`, `--wait <ms>`, `--preview`.
- `scripts/shot.mjs` — one screenshot per card into `./shots`.

Card ids: `iss-globe`, `solar-system`, `kp-index`, `solar-wind`,
`aurora-forecast`, `solar-flares`, `asteroids` (see `src/layout/cardRegistry.ts`).

## Build / test commands

```bash
npm run check     # tsc + eslint (bans `as` casts) + vitest
npm run smoke      # browser smoke (see above); --preview for prod build
npm run snap        # debug screenshot
npm run shot        # per-card screenshots → ./shots
npm run build       # production build → ./docs (GitHub Pages)
```

## Architecture notes

- `src/astro/` is pure math — **never** import Three.js or React there
  (mirrors `src/geo/` in the sibling `mathsculpt` project). It wraps
  `satellite.js` (TLE → geodetic position) and `astronomy-engine` (planet
  heliocentric vectors), plus `coords.ts` for lat/lon/AU → 3D scene vectors.
- `src/api/` is pure fetch+parse — **never** import React there. Each module
  takes an injectable fetch function (default: global `fetch`) so tests can
  mock it without touching the network.
- `src/render/` is the only place that touches Three.js. It can't be unit
  tested (`jsdom` has no WebGL) — verified via `scripts/smoke.mjs` instead
  (canvas mounts, no console errors). Both scene modules self-manage sizing
  via an internal `ResizeObserver` on the canvas; nobody needs to call the
  exposed `resize()` method manually.
- ESLint bans `as` type assertions (`@typescript-eslint/consistent-type-assertions:
  'never'`). Narrow `unknown` with a type-predicate helper
  (`function isRecord(v): v is Record<string, unknown>`) instead of casting.
  `src/api/cache.ts`'s `readCache<T>` takes a validator predicate
  (`isValue: (v: unknown) => v is T`) rather than casting its return value —
  follow that pattern for any new cached resource.

## Gotchas learned while building this

- **`react-grid-layout` is on v2**, a hooks-first rewrite with a different API
  from the commonly-documented v1 (`gridConfig`/`dragConfig`/`resizeConfig`
  objects, `useContainerWidth` for width, no `WidthProvider` needed). Don't
  reach for v1-style flat props or `react-grid-layout/legacy` docs/examples.
- **NOAA SWPC response shapes are inconsistent across products** — verified
  against the live endpoints, not just docs/memory:
  - `noaa-planetary-k-index.json` is an **array of objects**
    (`{time_tag, Kp, a_running, station_count}`), not the `[header, ...rows]`
    table format most other SWPC products use.
  - The solar-wind endpoint that actually resolves is
    `products/geospace/propagated-solar-wind-1-hour.json` (`[header, ...rows]`,
    numeric cells, column order `time_tag,speed,density,temperature,...`).
    `products/solar-wind/plasma-5-minute.json`, which several older
    tutorials reference, 404s.
  - If you add another SWPC product, `curl` the real endpoint first — don't
    assume the table shape from a similarly-named one.
- **NASA NeoWs (`api.nasa.gov/neo/rest/v1/feed`) has real, observed outages**
  (Heroku "Application Error" / 503), independent of DONKI on the same
  `api.nasa.gov` host. `AsteroidsCard`'s error state is not a bug when this
  happens — it's the intended graceful-failure path.
- **Playwright drag/resize needs a real multi-step `mouse.move`** (`{ steps: N
  }`), not a single jump — react-draggable/react-resizable can end up with a
  stuck placeholder or a half-registered gesture otherwise. For resizing a
  grid item, the horizontal delta must exceed one full column width (not just
  the pixel distance you'd eyeball) or the drag registers as a height-only
  change with no visible width difference — measure the actual column width
  from a `boundingBox()` diff rather than guessing a delta.
