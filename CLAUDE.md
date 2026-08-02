# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted. Put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.

Existing helpers:

- `scripts/smoke.mjs` — headless Chromium: default card visibility, toggling
  every card via the Cards menu, canvases mounting for the four WebGL cards
  (`iss-globe`, `solar-system`, `natural-events`, `fire-map`),
  drag-to-reposition, resize, `localStorage` persistence across reload, and
  layout reset. `--screenshot <path>`, `--preview` (prod build on :4173).
  Any console/page error → exit code 2.
- `scripts/snap.mjs` — single debug screenshot. Flags: `--out <path>`
  (required), `--show <cardId>` / `--hide <cardId>` / `--click <selector>`
  (repeatable), `--width`, `--height`, `--wait <ms>`, `--preview`.
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
- Static assets live in `public/` (copied verbatim to `docs/` on build) —
  currently `favicon.svg`, a self-contained SVG radar scope (cropped to its
  top-right quarter via `viewBox="28 0 32 32"`, full-bleed; the `#scope`
  gradient uses `gradientUnits="userSpaceOnUse"` so the crop stays dark toward
  the corner) referenced from `index.html`. Reference it with a **relative**
  `./favicon.svg` (not `/…`) so it resolves under the GitHub Pages sub-path
  (`vite.config.ts` sets `base: './'`).
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
- **All four 3D scenes share `orbitControlsExtras.attachKeyboardZoom`** — it
  makes the canvas focusable (`tabIndex`) and binds `+`/`-` to dolly the camera
  along its view direction (clamped to the controls' min/max distance), so the
  keys only affect the card the user has clicked into. The three
  `createEarthScene` globes additionally auto-rotate (`controls.autoRotate`,
  `AUTO_ROTATE_SPEED`); OrbitControls' `start` event and any keyboard zoom stop
  the spin the moment the user takes over. The solar-system scene gets keyboard
  zoom but no auto-rotate.
- **Three of the cards (`iss-globe`, `natural-events`, `fire-map`) share
  `createEarthScene`.** The globe exposes `setSatellites` (named markers with
  labels), `setMarkers` (generic id/colour/label markers), and `setFirePoints`
  (a single `THREE.Points` cloud). Label sprites (`src/render/labelSprite.ts`)
  are depth-tested, so the opaque Earth mesh hides labels on the far side for
  free — there is no manual occlusion math.
- **Fire points carry an optional `info` string and get a hover tooltip.**
  `setFirePoints` stores the per-point `info` (built in `FireMapCard`:
  detection time + brightness K + confidence). A `pointermove` listener on the
  canvas raycasts the `THREE.Points` cloud (`raycaster.params.Points.threshold`)
  and shows a reusable label sprite at the hovered point. Points on the far side
  are skipped via a horizon test (`dot(camera − point, point) > 0`) since the
  Points cloud isn't occluded by the Earth mesh the way opaque meshes are.
- **The ISS card caches TLEs per CelesTrak group, not per group-combination**
  (`useTleSatellites`), under `space-radar:tle-group:<name>` keys. Caching by
  combination (the earlier design) re-fetched huge groups on every toggle —
  tripping CelesTrak's 403 rate-limit — and piled up unbounded localStorage
  entries (a `QuotaExceededError` on `setItem`). `writeCache` now also swallows
  quota/storage errors. CelesTrak's `stations` group is the whole "Space
  Stations" set (cargo ships + cubesats deployed from the ISS), not just
  ISS/CSS — hence the "Space stations & nearby" label.
- **Numeric settings inputs commit on blur/Enter, not per keystroke** (see
  `CardSettingsPopup`). Clamping every keystroke made "type 2 into a field
  showing 1" become "12" → clamped to the max (4/8). The field keeps a raw
  draft string and clamps once on commit; focus selects-all so typing replaces.
- **A 3D scene's camera `far` must clear the far side of its star sphere at max
  zoom-out** (`camera distance + starfield radius`). The Solar System card
  showed a grey disc because `far` (500) was less than 300 + 400.
- **Globe/solar-system labels and markers keep a constant on-screen *pixel*
  size** via `scaleLabelToScreen` (in `labelSprite.ts`) and `scaleMarker` (in
  `earthScene`), which rescale every frame to `px × worldPerPx × cameraDistance`
  where `worldPerPx = 2·tan(fov/2) / canvas.clientHeight`. Dividing by the
  canvas pixel height is the crucial part: the earlier `K × cameraDistance`
  scale was constant only as a *fraction* of the viewport, so labels/markers
  **grew when a card was expanded to full screen** (a larger canvas). Fire
  points use `sizeAttenuation:false` (size in framebuffer px, so multiply by
  `renderer.getPixelRatio()`) for the same constant-size effect. Solar-system
  planet names are labels too (added alongside the moon labels).
- **`IssGlobeCard`'s scene effect must guard `if (!scene || !data) return`.**
  Without the `!data` guard it pushes a null ISS frame on first mount before
  TLEs load, which makes `waitFor(setIssPosition called)` in the test resolve
  on that premature null call instead of the real position.
- **FIRMS needs a separate MAP_KEY** (`src/api/firmsMapKey.ts`, now populated).
  Valid FIRMS requests **do** send `access-control-allow-origin: *`, so the Fire
  Map card works from the browser with no proxy — the earlier "no CORS" note was
  only the invalid-key **400 error page**, which omits the header. The card
  still degrades gracefully (empty-key prompt / network error) rather than
  throwing.
- **EONET looks US-only from a naive query** — its events are sorted newest-
  first and open *wildfire* events (mostly the US-only InciWeb source) dominate,
  so `status=open&limit=50` comes back ~all US. `fetchNaturalEvents` instead
  fetches several categories in parallel (`Promise.allSettled`, one erroring
  category tolerated; only all-failing throws) **without** a `days` filter —
  long-running open events like volcanoes have older last-geometry dates and get
  dropped by `days`. **Category queries alone still miss non-US wildfires**
  (e.g. Europe): those events are open but their last-geometry dates are old, so
  they never make the newest-first `limit` cut. So `fetchNaturalEvents` *also*
  fetches per-continent `bbox` queries (`REGION_BBOXES`, minus North America
  which the category queries already cover) to pull them into the pool.
  `NaturalEventsCard.pickDiverse` then round-robins across **region+category**
  buckets (region via the exported `regionOf`), so both geography and type are
  spread — Europe/Asia/etc. show alongside the far more numerous US wildfires
  instead of being crowded out of the `maxEvents` slice.
- **Default layout is six cards in two columns** (`w:2`), reading order
  ISS · Solar System / Natural Events · APOD / Launches · Asteroids. The
  registry lists these first (all `defaultVisible:true`); the rest are hidden and
  parked below (`y ≥ 6`). `scripts/smoke.mjs`'s `DEFAULT_VISIBLE` /
  `HIDDEN_BY_DEFAULT` and `tests/app.test.tsx` (which fullscreens a
  *default-visible* card) must be kept in sync with these defaults.
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
