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
`aurora-forecast`, `solar-flares`, `asteroids`, `natural-events`, `launches`,
`apod`, `fire-map` (see `src/layout/cardRegistry.ts`).

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
  heliocentric vectors + `moonPositions.ts`), plus `coords.ts` for lat/lon/AU →
  3D scene vectors. **astronomy-engine only has moon ephemerides for Earth's
  Moon (`GeoMoon`) and Jupiter's four Galilean moons (`JupiterMoons`)** — there
  is no data for Saturn/Uranus/Neptune moons, so the Solar System card shows
  only those five (drawn on exaggerated display orbits since real separations
  are far smaller than a planet's rendered radius).
- `src/api/` is pure fetch+parse — **never** import React there. Each module
  takes an injectable fetch function (default: global `fetch`) so tests can
  mock it without touching the network.
- `src/render/` is the only place that touches Three.js. It can't be unit
  tested (`jsdom` has no WebGL) — verified via `scripts/smoke.mjs` instead
  (canvas mounts, no console errors). Both scene modules self-manage sizing
  via an internal `ResizeObserver` on the canvas; nobody needs to call the
  exposed `resize()` method manually.
- **Card settings** are a discriminated union in `src/layout/types.ts`:
  `{ kind: 'number', ... }` renders a stepper, `{ kind: 'multiselect', options,
  ... }` renders a checkbox list whose value is a `string[]`. Read them in a
  card with the `numberSetting(values, id, fallback)` /
  `listSetting(values, id, fallback)` helpers from `layoutState.ts` — never
  index `settings[id]` directly, since the value type is `number | string[]`.
- **Three of the cards (`iss-globe`, `natural-events`, `fire-map`) share
  `createEarthScene`.** The globe exposes `setSatellites` (named markers with
  labels), `setMarkers` (generic id/colour/label markers), and `setFirePoints`
  (a single `THREE.Points` cloud). Label sprites (`src/render/labelSprite.ts`)
  are depth-tested, so the opaque Earth mesh hides labels on the far side for
  free — there is no manual occlusion math.
- **Numeric settings inputs commit on blur/Enter, not per keystroke** (see
  `CardSettingsPopup`). Clamping every keystroke made "type 2 into a field
  showing 1" become "12" → clamped to the max (4/8). The field keeps a raw
  draft string and clamps once on commit; focus selects-all so typing replaces.
- **A 3D scene's camera `far` must clear the far side of its star sphere at max
  zoom-out** (`camera distance + starfield radius`). The Solar System card
  showed a grey disc because `far` (500) was less than 300 + 400.
- **Globe/solar-system labels keep a constant on-screen size** by rescaling each
  sprite every frame to `K × cameraDistance` (see `earthScene` / the moon
  labels) — sprite world-size otherwise changes apparent size with zoom.
- **`IssGlobeCard`'s scene effect must guard `if (!scene || !data) return`.**
  Without the `!data` guard it pushes a null ISS frame on first mount before
  TLEs load, which makes `waitFor(setIssPosition called)` in the test resolve
  on that premature null call instead of the real position.
- **FIRMS needs a separate MAP_KEY** (`src/api/firmsMapKey.ts`, empty by
  default) and, in testing, did **not** send CORS headers — the Fire Map card
  may need a proxy to work from the static site. The card degrades gracefully
  (add-key prompt / network error) rather than throwing.
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
- **NASA DONKI on `api.nasa.gov` 503s frequently.** Flares therefore come from
  `services.swpc.noaa.gov/json/goes/primary/xray-flares-7-day.json` (reliable,
  CORS `*`); DONKI is only used for CMEs, best-effort. The CCMC-direct DONKI
  host (`kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/...`) works from curl **but
  sends no CORS headers**, so it's unusable from the browser — don't "switch"
  to it.
- **Launch Library 2 (`ll.thespacedevs.com`) free tier = 15 requests/hour.**
  Keep the launches card's TTL/poll at an hour or more.
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
