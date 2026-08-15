# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted. Put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.

Existing helpers:

- `scripts/smoke.mjs` — headless Chromium: default card visibility, toggling
  every card via the Cards menu, canvases mounting for the six WebGL cards
  (`iss-globe`, `solar-system`, `natural-events`, `fire-map`, `quakes`,
  `aurora-globe`), drag-to-reposition, resize, `localStorage` persistence across reload, and
  layout reset. `--screenshot <path>`, `--preview` (prod build on :4173).
  Any console/page error → exit code 2.
- `scripts/snap.mjs` — single debug screenshot. Flags: `--out <path>`
  (required), `--show <cardId>` / `--hide <cardId>` / `--click <selector>`
  (repeatable), `--width`, `--height`, `--wait <ms>`, `--preview`.
- `scripts/shot.mjs` — one screenshot per card into `./shots`.
- `scripts/pngDiff.mjs` — `countDiffPixels(pngBufferA, pngBufferB, tolerance?)`:
  decodes two 8-bit PNGs and counts pixels that actually changed, for
  Playwright screenshot comparisons where exact-byte `Buffer.equals()` is too
  sensitive (see the `earthScene`/headless-rasterizer-noise note below). Used
  by `smoke.mjs`'s auto-rotate section; reach for it any time a smoke check
  needs "did this canvas really change" rather than "did any byte change."

Card ids: `iss-globe`, `solar-system`, `kp-index`, `solar-wind`,
`aurora-forecast`, `solar-flares`, `asteroids`, `natural-events`, `launches`,
`apod`, `fire-map`, `epic`, `quakes`, `solar-imagery`, `solar-cycle`, `moon`,
`aurora-globe`, `nasa-images` (see `src/layout/cardRegistry.ts`).

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
  ... }` renders a checkbox list whose value is a `string[]`, `{ kind: 'select',
  options, ... }` renders a radio group whose value is a single `string`. Read
  them in a card with the `numberSetting(values, id, fallback)` /
  `listSetting(values, id, fallback)` / `stringSetting(values, id, fallback)`
  helpers from `layoutState.ts` — never index `settings[id]` directly, since the
  value type is `number | string[] | string`. `NumberField` (`src/layout/
  NumberField.tsx`, shared by `CardSettingsPopup` and `GlobalSettingsPopup`)
  rounds its committed value to the nearest `step`, not the nearest integer
  (`Math.round(next / step) * step`, then a second rounding pass to shake off
  float noise like `0.30000000000000004`) — needed once a fractional `step`
  (the 0.1 label-scale coefficient below) showed up; for the default `step: 1`
  it's identical to the old `Math.round(next)`.
- **General settings** (header "Settings" button → `GlobalSettingsPopup`,
  state in `src/layout/globalSettings.ts` + `useGlobalSettings.ts`) hold three
  values, all persisted to their own `space-radar:global-settings:v1`
  localStorage key (which is already per-browser, so desktop and mobile
  naturally end up with independent values with no viewport-based branching
  needed) and sanitized *per-field* (`sanitizeGlobalSettings` falls back
  field-by-field, not all-or-nothing — old storage saved before a new field
  existed keeps its other values instead of resetting everything):
  - `labelScale`: a 0.5–2.5× multiplier on every label/marker's on-screen
    pixel size across all five `createEarthScene` cards (`earthScene.ts`'s
    `setLabelScale`, applied inside `rescaleLabel`/`scaleMarker` each frame,
    and patched onto any already-created fire/aurora `PointsMaterial.size`
    since those bake their size in once at creation).
  - `rotateSpeed`: a 0–3× multiplier on the same five cards' idle auto-rotate
    speed (`setAutoRotateSpeed`, multiplies `AUTO_ROTATE_SPEED`). **0 doubles
    as "off"** — no separate boolean toggle, since a zero speed is a zero
    per-frame rotation delta regardless of the `autoRotate` flag.
  - `density`: `'comfortable' | 'compact'`, mapped through
    `DENSITY_ROW_HEIGHT` to `GridLayout`'s `rowHeight` prop (was a hardcoded
    module constant; now threaded from `App` through `GridLayout` since it
    has to be user-configurable). Affects every card, not just the globes.
  `App` passes `labelScale`/`rotateSpeed` down through `GridLayout`'s
  `CardComponentProps` to every card (all cards get the props; only the five
  globe cards read them) and `rowHeight` directly into `GridLayout`'s
  `gridConfig`. `SelectField` (`src/layout/SelectField.tsx`, extracted
  alongside `NumberField` once `GlobalSettingsPopup` needed the same
  radio-group UI `CardSettingsPopup` already had for per-card `select`
  settings) renders the density choice.
- **Per-card "Earth style" setting** (`earthStyle`, `'globe' | 'map'`, on
  `iss-globe`/`natural-events`/`fire-map`/`quakes`/`aurora-globe`) swaps
  `earthScene.ts`'s Earth mesh between the default photo texture lit by a
  directional "sun" light (day/night terminator) and a flat, fully *unlit*
  `MeshBasicMaterial` using `src/assets/earth-map.jpg` — a blank political
  world map (Wikimedia Commons, FelixCountryBalls163, CC BY 4.0, downscaled to
  2048×1024) — for cards where the shaded/dark side hides markers. Both
  textures/materials load eagerly at scene creation (matches the existing
  eager-load pattern for `earth-diffuse.jpg`); `setEarthStyle` just swaps
  `earth.material`, so markers/labels/occlusion are unaffected either way (same
  sphere geometry).
- **All six 3D scenes share `orbitControlsExtras.attachKeyboardZoom`** — it binds
  `+`/`-` (and `=`/`_`) to dolly the camera along its view direction (clamped to
  the controls' min/max distance). **The keys are routed by *hover*, not DOM
  focus: a `window` keydown listener acts on whichever canvas the pointer is over
  (tracked via `pointerenter`/`pointerleave` in a module-level
  `hoveredCanvases` set).** This is deliberate — a focus-only scheme is a bug:
  focus can only be gained by clicking, and clicking a globe also stops its
  auto-rotation, so the keys would never fire *while the globe is still spinning*.
  A click-focused canvas is a fallback target only when the pointer is over no
  globe, so two cards never zoom at once. (Zoom is keyboard + mouse-wheel only; an
  on-screen-button version was tried and removed.) The five `createEarthScene`
  globes additionally auto-rotate (`controls.autoRotate`, `AUTO_ROTATE_SPEED`).
  **Only a rotate/pan move stops the spin — zooming (wheel, trackpad pinch,
  keyboard `+`/`-`, or a middle-drag dolly) leaves it spinning.** OrbitControls
  fires `start` on any pointer interaction, but only *sets* its internal
  `state` for gestures that need to track motion across multiple events — a
  mouse-wheel/trackpad-pinch zoom is a one-shot action handled inline in the
  wheel handler, which never touches `state`, so `start` fires with `state`
  left at `NONE` (`-1`); a middle-mouse-drag dolly *is* a multi-event drag, so
  it gets its own state, `DOLLY` (`1`). **Both must be excluded** —
  `earthScene.ts`'s `stopAutoRotateOnMove` only clears `autoRotate` when
  `state` is neither. (An earlier version excluded only `DOLLY`, on the wrong
  assumption that wheel zoom also sets `state=DOLLY`; that let trackpad
  pinch-zoom, which browsers deliver as wheel events, incorrectly stop the
  spin — caught by manual testing, not the smoke suite, since the zoom's own
  end-of-gesture damping produced just enough pixel movement to clear the
  smoke check's "still spinning" threshold by coincidence.) The enum isn't
  part of OrbitControls' public type declarations, so `state` is read via an
  `isRecord` structural check rather than an `as` cast, and both values are
  hardcoded with a comment as the source of truth. Two-finger touch gestures
  always mix a pinch with pan/rotate, so those still stop it. The solar-system
  scene gets keyboard zoom but no auto-rotate. `scripts/smoke.mjs` guards the
  zoom-hover-while-spinning case (hovers, does not click, the solar-system
  canvas) and separately guards the stop/no-stop distinction on `aurora-globe`
  via `scripts/pngDiff.mjs`'s `countDiffPixels` — **exact-byte
  `Buffer.equals()` is not a reliable "did it move" signal on these canvases**:
  headless Chromium's software rasterizer leaves small frame-to-frame dithering
  noise on the transparent label sprites/wireframe grid even when nothing
  moved, so two screenshots of a genuinely static globe still differ by a few
  bytes — confirmed empirically (a plain drag/pan *distance*, not just the
  press, also leaves multiple seconds of OrbitControls damping "coast" that
  reads as motion; the smoke check uses a zero-movement press to isolate the
  state transition, plus a 2s settle wait, then thresholds `countDiffPixels`
  at 1,000 vs. the ~10,000+ pixels genuine rotation moves per 600ms).
  `MIN_CAMERA_DISTANCE` (`EARTH_RADIUS_UNITS + 0.3`) sets how close the five
  globes can zoom in — a flat `3` (1 full unit of clearance) was too far to
  make out detail.
- **Five of the cards (`iss-globe`, `natural-events`, `fire-map`, `quakes`,
  `aurora-globe`) share `createEarthScene`.** The globe exposes `setSatellites`
  (named markers with labels), `setMarkers` (generic id/colour/label markers),
  `setFirePoints` (a single yellow→red `THREE.Points` cloud), and
  `setAuroraPoints` (an additive-blended green `THREE.Points` cloud whose
  brightness scales with per-point probability, `depthWrite:false` so the glow
  layers). Label sprites (`src/render/labelSprite.ts`) are depth-tested, so the
  opaque Earth mesh hides labels on the far side for free — there is no manual
  occlusion math.
- **Fire points carry an optional `label` string drawn as a permanent sprite
  beside the point** (not a hover tooltip — there are several thousand points, so
  `FireMapCard` labels only the strongest `labelCount` fires by brightness; the
  full `THREE.Points` cloud is unlabelled). The label text (detection time +
  brightness K + confidence) is built in `FireMapCard`. These are ordinary
  depth-tested `labelSprite`s, so the opaque Earth hides far-side ones for free —
  no raycast/horizon math (the earlier hover-tooltip approach needed both).
- **FIRMS default source is `VIIRS_NOAA20_NRT`, not `VIIRS_SNPP_NRT`.** The
  Suomi-NPP NRT feed went intermittent and now returns ~0 rows for `world/1`;
  NOAA-20 (and NOAA-21) are the healthy operational VIIRS feeds. If the fire card
  ever shows almost no points again, `curl` the source URLs and switch — it's a
  feed outage, not a parsing bug.
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
  ISS · Solar System / Natural Events · APOD / Launches / Asteroids. The
  registry lists these first (all `defaultVisible:true`); the rest are hidden and
  parked below (`y ≥ 6`). `scripts/smoke.mjs`'s `DEFAULT_VISIBLE` /
  `HIDDEN_BY_DEFAULT` and `tests/app.test.tsx` (which fullscreens a
  *default-visible* card) must be kept in sync with these defaults.
- **Below `GridLayout.MOBILE_BREAKPOINT_PX` (700px container width, matching
  the `#cardMenu` CSS breakpoint), cards stack in a single, still-draggable
  column** instead of the 4-col grid (`GridLayout`'s `toMobileRglLayout`, cols
  forced to 1). Reordering is tracked separately from the desktop
  x/y/w-per-card `layout` map: `StoredLayoutState.mobileOrder` is just a
  `string[]` of visible ids in stacked order, defaulting to reading order
  (top-to-bottom, left-to-right on the desktop layout —
  `layoutState.ts`'s `readingOrder`) and kept in sync by `toggleVisibility`
  (hide → remove, show → append at the end). Resizing a card's *height* in
  mobile mode still writes through to the shared desktop `layout[id].h` (x/y/w
  there are untouched — mobile's are synthetic). **`toMobileRglLayout` must
  stack using each card's actual height in grid rows (`y +=
  rect.h`), not just its array index** — react-grid-layout's drag/collision
  math operates on the given `y` values directly during an interactive drag,
  so index-based y's (e.g. every `h:2` card at consecutive integers 0,1,2…,
  which overlap) confused live reordering even though a *static* render still
  looked right, because the library's own compaction pass silently resolves
  overlapping-but-correctly-ordered input on a plain re-render.
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
  - The `json/solar-cycle/*` products (`observed-solar-cycle-indices.json`,
    `predicted-solar-cycle.json`) are **arrays of objects**, but their keys
    `time-tag` and `f10.7` contain characters you can't destructure — read them
    via string index access (`item['f10.7']`). Missing values are the sentinel
    **`-1`**, not `null` — map them to `null` (`toCycleNumber` in `swpc.ts`).
    The observed series runs back to 1749; keep only the recent tail
    (`OBSERVED_TAIL_MONTHS`) so the localStorage cache stays small.
  - `json/ovation_aurora_latest.json` is `{ "Observation Time",
    "Forecast Time", coordinates: [[lon, lat, probabilityPercent], ...] }` on a
    1°×1° grid with **longitude 0..360** (the trig in `coords.ts` handles that
    fine). ~⅔ of cells are 0 — `parseAurora` drops them.
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
