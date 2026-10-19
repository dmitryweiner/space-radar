# CLAUDE.md — working notes for this repo

## Tooling: prefer permanent scripts over throwaway ones

Do **not** write a temporary Playwright/Node script via `cat > tmp.mjs <<EOF`
every time something needs to be checked or screenshotted. Put reusable
tooling in `scripts/` **once**, give it CLI flags, and call it thereafter.

Existing helpers:

- `scripts/smoke.mjs` — headless Chromium over the Scene view (the whole UI):
  exactly one WebGL canvas, default layers on, a layer toggle persisting, the
  globe rendering, a status chip opening its inspector panel, the scrubber
  leaving/returning to Live, the Earth/Sun/Solar System tabs (Sun: wheel
  zoom + double-click fit, wavelength swap, grid, region toggle, and a live
  marker click → details when SWPC delivered any), hover-routed
  keyboard zoom (solar-system canvas), Solar System fly-to (a body chip →
  overlay + view change → "Whole system"), the Solar System data layers
  (on by default, toggling one removes its fly-to chips — UI only, their JPL
  data needs the deployed proxy), auto-rotate stop-only-on-move (see
  the OrbitControls `state` note below), the general settings popup (label
  scale / auto-rotate speed, rotate 0 stops the spin, persistence, Escape),
  the Earth style select, and on an emulated phone (`hasTouch`/`isMobile`,
  swipes sent through CDP `Input.dispatchTouchEvent` since Playwright's
  `touchscreen` can only tap) a one-finger drag rotating the full-screen globe
  without scrolling the page, the Layers bottom sheet, and a Details panel's ×
  returning to the Details list (not closing the sheet). The ISS layer is
  switched off before the "did the globe stop" checks — its markers move every
  second. `--screenshot <path>`, `--preview` (prod build on :4173). Any
  console/page error → exit code 2. "Did the globe stop" checks use
  `settledDiff` (poll until still, up to 10s), not a fixed wait: OrbitControls'
  damping decays *per frame* and the software rasterizer's frame rate is low.
- `scripts/devServer.mjs` — `ensureServer({ preview })` shared by smoke and
  snap: reuses a running Space Radar dev server, **skips ports held by other
  projects' Vite servers** (checks the page `<title>`, not just HTTP 200 —
  another project often sits on :5173) and spawns one on the first free port,
  **in its own process group** — `stop()` kills the group, because killing
  just `npx` left the real vite running as an orphan that later runs then
  silently reused (with whatever env it had been started with).
- `scripts/snap.mjs` — single debug screenshot. Flags: `--out <path>`
  (required), `--tab <Earth|Sun|Solar System>`, `--click <selector>` /
  `--click-at <selector:x,y>` / `--key <key>` / `--storage 'key=<json>'` (seed
  localStorage before boot) (repeatable), `--width`, `--height`, `--wait <ms>`,
  `--preview`. E.g. `--tab 'Solar System' --click '.body-chip:text-is("Saturn")'`.
- `scripts/pngDiff.mjs` — `countDiffPixels(pngBufferA, pngBufferB, tolerance?)`:
  decodes two 8-bit PNGs and counts pixels that actually changed, for
  Playwright screenshot comparisons where exact-byte `Buffer.equals()` is too
  sensitive (see the `earthScene`/headless-rasterizer-noise note below). Used
  by `smoke.mjs`'s auto-rotate section; reach for it any time a smoke check
  needs "did this canvas really change" rather than "did any byte change."

Layer ids: see `src/layers/registry.ts`; inspector panel ids: see
`src/scene/panels.tsx`.

## Build / test commands

**Deploy = push to `main`.** `.github/workflows/deploy.yml` runs `npm ci`,
`npm run check`, `npm run build` and publishes `dist/` to GitHub Pages (repo
Pages source: "GitHub Actions"). The build output is not committed — the old
`docs/` folder is gone. PRs run the same check + build without deploying.

```bash
npm run worker:deploy  # deploy the caching proxy (worker/) to Cloudflare
npm run worker:tail    # live worker logs
npm run check     # tsc + eslint (bans `as` casts) + vitest
npm run smoke      # browser smoke (see above); --preview for prod build
npm run snap        # debug screenshot
npm run build       # production build → ./dist (local check only — CI deploys)
```

## Architecture notes

- `src/astro/` is pure math — **never** import Three.js or React there
  (mirrors `src/geo/` in the sibling `mathsculpt` project). It wraps
  `satellite.js` (TLE → geodetic position) and `astronomy-engine` (planet
  heliocentric vectors + `moonPositions.ts`), plus `coords.ts` for lat/lon/AU →
  3D scene vectors. **astronomy-engine only has moon ephemerides for Earth's
  Moon (`GeoMoon`) and Jupiter's four Galilean moons (`JupiterMoons`)** — there
  is no data for Saturn/Uranus/Neptune moons, so the Solar System scene shows
  only those five (drawn on exaggerated display orbits since real separations
  are far smaller than a planet's rendered radius).
- **Caching proxy (`worker/`, Cloudflare Worker
  `https://space-radar-proxy.dmitry-weiner.workers.dev`, see `backend-plan.md`).**
  `worker/src/routes.ts` is the single allowlist table (service → upstream,
  TTL, key injection) as pure functions, tested in `npm run check` and
  **imported by the client too** (`src/api/proxy.ts` → `toProxyPath`), so the
  two can't drift. Every `src/api` module still builds its *direct* upstream
  URL (with the client key) and calls `fetchViaProxy(fetchFn, url)`: proxy
  first, direct fallback on any proxy error/unreachability — so the client
  keys in `nasaApiKey.ts`/`firmsMapKey.ts` are deliberately kept as the
  fallback path. Worker keys are secrets (`wrangler secret put NASA_API_KEY` /
  `FIRMS_MAP_KEY --config worker/wrangler.jsonc`). Cache = KV + in-isolate
  `Map`, stale-while-revalidate, last-good on upstream error, empty 200s never
  cached. **Free-tier KV allows only 1,000 writes/day** — `put` failures are
  swallowed (the isolate cache keeps serving) and no TTL is under 10 min.
  **LL2 throttles Cloudflare's shared egress IPs** (429 straight away), so
  launches usually go via the client's direct fallback — expected, not a bug.
  `describeHttpError` redacts keys from the URL it shows in the UI.
  **JPL (`ssd-api.jpl.nasa.gov`: fireballs, SBDB query) and Horizons
  (`ssd.jpl.nasa.gov/api`, its own `horizons` service) send no CORS headers**,
  so those layers work *only* through the deployed proxy — a new route there
  needs `npm run worker:deploy` before the browser can use it. Horizons 503s
  when busy; `api/horizons.ts` retries with backoff and the spacecraft layer
  fetches two craft at a time. **`VITE_PROXY_BASE`** overrides the proxy URL
  for development. Local `wrangler dev` is no use for the JPL routes: this
  wrangler's runtime is older than the worker's compatibility date (needs
  `--compatibility-date 2026-05-03`) and even then it can't reach the JPL
  hosts (502, while production gets 200) — test JPL routes against a small
  Node proxy or the deployed worker instead.
- `src/api/` is pure fetch+parse — **never** import React there. Each module
  takes an injectable fetch function (default: global `fetch`) so tests can
  mock it without touching the network.
- Static assets live in `public/` (copied verbatim to `dist/` on build) —
  currently `favicon.svg`, a self-contained SVG radar scope (cropped to its
  top-right quarter via `viewBox="28 0 32 32"`, full-bleed; the `#scope`
  gradient uses `gradientUnits="userSpaceOnUse"` so the crop stays dark toward
  the corner) referenced from `index.html`. Reference it with a **relative**
  `./favicon.svg` (not `/…`) so it resolves under the GitHub Pages sub-path
  (`vite.config.ts` sets `base: './'`).
- **This Vite version (8.x) bundles with Rolldown, not Rollup** — its
  chunking/output config lives under `build.rolldownOptions` (`rollupOptions`
  still works but is deprecated; the `manualChunks(id, meta)` function
  signature is unchanged from Rollup's). `vite.config.ts` uses it to put every
  `node_modules` import in its own `vendor` chunk, separate from app code —
  three.js + satellite.js + astronomy-engine + react/react-dom/
  react-grid-layout are the bulk of the bundle and essentially never change
  between deploys, so splitting them out keeps that chunk's hash (and browser
  cache) stable across app-only releases; it doesn't shrink the first-visit
  download. `chunkSizeWarningLimit: 1000` silences Vite's "chunk >500kB"
  warning, which the vendor chunk (~900kB min, ~250kB gzip) will always trip —
  that's an inherent cost of a client-side 3D dashboard, not something worth
  chasing down further.
- `src/render/` is the only place that touches Three.js. It can't be unit
  tested (`jsdom` has no WebGL) — verified via `scripts/smoke.mjs` instead
  (canvas mounts, no console errors). Both scene modules self-manage sizing
  via an internal `ResizeObserver` on the canvas; nobody needs to call the
  exposed `resize()` method manually.
- **Settings** (per layer, and per inspector panel) are a discriminated union
  in `src/settings/types.ts`: `{ kind: 'number', ... }` renders a stepper,
  `{ kind: 'multiselect', options, ... }` a checkbox list whose value is a
  `string[]`, `{ kind: 'select', options, ... }` a radio group whose value is a
  single `string` (`SettingField` / `SelectField`). Read them with the
  `numberSetting(values, id, fallback)` / `listSetting(values, id, fallback)`
  helpers from `src/settings/values.ts` — never index `settings[id]` directly,
  since the value type is `number | string[] | string`. (`src/cards/` holds the
  self-contained panels the inspector shows — the name is historical; there is
  no card grid any more.)
- **General settings** (header "Settings" button → `GlobalSettingsPopup`,
  state in `src/settings/globalSettings.ts` + `useGlobalSettings.ts`) are a
  **module-level store** (`getGlobalSettings`/`updateGlobalSettings`,
  components subscribe via `useGlobalSettings()` = `useSyncExternalStore`) so
  non-React code (formatters inside a layer's `describe()`, `useApiResource`)
  reads the same values. Tests that seed the storage key call
  `reloadGlobalSettings()`. Persisted to their own `space-radar:global-settings:v1` localStorage
  key (per-browser, so desktop and mobile naturally keep independent values)
  and sanitized *per-field* (old storage missing a field keeps its other
  values; an old `density` field is simply dropped):
  - `labelScale`: a 0.5–2.5× multiplier on every label/marker's on-screen
    pixel size on the globe (`earthScene.ts`'s `setLabelScale`, applied inside
    `rescaleLabel`/`scaleMarker` each frame, and patched onto any
    already-created fire/aurora `PointsMaterial.size` since those bake their
    size in once at creation) **and in the Solar System scene**
    (`solarSystemScene.ts`'s `setLabelScale`: planet/moon/marker labels and
    layer marker sizes, in `placeLabel`).
  - `rotateSpeed`: a 0–3× multiplier on the globe's idle auto-rotate speed
    (`setAutoRotateSpeed`, multiplies `AUTO_ROTATE_SPEED`). **0 doubles as
    "off"** — no separate boolean toggle.
  - `timeZone` (`utc`|`local`) and `units` (`metric`|`imperial`): **all**
    user-visible times/distances/speeds go through `src/format/display.ts`
    (`formatTime`, `formatDistance`, `formatSpeed`, …) — never hand-format a
    "… UTC" or "… km" string. Zone-less "YYYY-MM-DD hh:mm" feed strings are
    UTC. Fire labels bake the time into sprites, so `firesLayer`'s memo keys
    on `timeZone`. AU stays AU.
  - `startScene` (`last`|scene id): overrides the stored tab on mount only.
  - `dataSaver`: `useApiResource` stretches every TTL/poll ×3
    (`DATA_SAVER_FACTOR`); SDO/GOES images use their 512/678 px renditions;
    GIBS mosaic/night lights are fetched at 1024×512; both scenes'
    `setLowPower` cap rendering at 30 fps (`render/lowPower.ts` frame gate)
    with a 1× pixel ratio (earthScene re-derives fire/aurora point sizes).
  - "Reset everything…" (two taps, no `window.confirm`) removes every
    `space-radar:` localStorage key and reloads.
  `App` passes labelScale/rotateSpeed/dataSaver/startScene to `SceneView`.
- **Earth style** (`earthStyle` in scene state, `'globe' | 'satellite' |
  'map'`, the radio group under the layer list) swaps `earthScene.ts`'s Earth
  material between the photo texture lit by a directional "sun" light
  (day/night terminator), the GIBS mosaic (below), and a flat, fully *unlit*
  `MeshBasicMaterial` using `src/assets/earth-map.jpg` — a blank political
  world map (Wikimedia Commons, FelixCountryBalls163, CC BY 4.0, downscaled to
  2048×1024) — for when the shaded side hides markers. `setEarthStyle` just
  swaps `earth.material`, so markers/labels/occlusion are unaffected.
- **Touch:** both scenes live in a page that never scrolls (`#app` is exactly
  `100dvh`), so OrbitControls keeps its own `touch-action: none` and one finger
  rotates; two fingers rotate + pinch-zoom (`touches.TWO = DOLLY_ROTATE`). (The
  old dashboard's "cooperative gestures" — one finger scrolls the page — went
  away with the card grid.)
- **Both 3D scenes share `orbitControlsExtras.attachKeyboardZoom`** — it binds
  `+`/`-` (and `=`/`_`) to dolly the camera along its view direction (clamped to
  the controls' min/max distance). **The keys are routed by *hover*, not DOM
  focus: a `window` keydown listener acts on whichever canvas the pointer is over
  (tracked via `pointerenter`/`pointerleave` in a module-level
  `hoveredCanvases` set).** This is deliberate — a focus-only scheme is a bug:
  focus can only be gained by clicking, and clicking a globe also stops its
  auto-rotation, so the keys would never fire *while the globe is still spinning*.
  A click-focused canvas is a fallback target only when the pointer is over no
  scene, so two canvases never zoom at once. (Zoom is keyboard + mouse-wheel only; an
  on-screen-button version was tried and removed.) The Earth globe
  additionally auto-rotates (`controls.autoRotate`, `AUTO_ROTATE_SPEED`).
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
  canvas) and separately guards the stop/no-stop distinction on the Scene globe
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
  `MIN_CAMERA_DISTANCE` (`EARTH_RADIUS_UNITS + 0.3`) sets how close the
  globe can zoom in — a flat `3` (1 full unit of clearance) was too far to
  make out detail.
- **Layers (`src/layers/`).** The data half of each geographic source is a
  `LayerDefinition` (`issLayer`, `quakesLayer`, `firesLayer`, `auroraLayer`,
  `eonetLayer`, …): its own `settings` plus a `useLayer(settings, time)` *hook*
  returning `{ frame, loading, error, summary, legend, describe(hit) }`
  (unit-tested with `renderHook`, e.g. `tests/issLayer.test.ts`). `applyFrame` only touches the fields a frame carries, so `{}`
  (still loading) draws nothing. `time` is `null` for live (layers tick on
  their own via `useClock`) or a fixed ms instant from the Scene scrubber.
  Since `useLayer` is a hook, a host must call it unconditionally — the Scene
  view mounts one tiny host component per enabled layer rather than calling
  hooks in a loop.
- **`earthScene` is layered.** `scene.layer(id)` returns an independent
  `EarthLayerHandle` (own THREE.Group: ISS, satellites, markers, fire/aurora
  Points; `setVisible`, `removeLayer`) — there is no flat single-layer API any
  more. Click hits report `(hit, layerId)`. **The "sun" light sits over the
  real sub-solar point** (`src/astro/subsolar.ts`, `setSunPosition`) and **the
  initial camera opens over the sunlit hemisphere** — with a real terminator a
  fixed start view is a black night side half the day. Ambient was raised so
  night continents stay faintly readable.
- **`earthStyle: 'satellite'`** = NASA GIBS VIIRS true-colour daily mosaic
  (`src/api/gibs.ts`, WMS GetMap 2048×1024, CORS `*`, no key). Starts at
  today−2 and steps back while a day 4xx's or is under 150 kB (the newest day
  is still filling in, mostly black). Even complete days have black no-data
  wedges between swaths, so `useGibsTexture` composites the mosaic over the
  static photo texture (black pixels → base) in a canvas; one download per
  page load, shared by every globe.
- **The globe (`createEarthScene`)** layer handles expose `setSatellites`
  (named markers with labels), `setMarkers` (generic id/colour/label markers),
  `setFirePoints` (a single yellow→red `THREE.Points` cloud), and
  `setAuroraPoints` (an additive-blended green `THREE.Points` cloud whose
  brightness scales with per-point probability, `depthWrite:false` so the glow
  layers). Label sprites (`src/render/labelSprite.ts`) are depth-tested, so the
  opaque Earth mesh hides labels on the far side for free — there is no manual
  occlusion math.
- **Fire points carry an optional `label` string drawn as a permanent sprite
  beside the point** (not a hover tooltip — there are several thousand points, so
  `firesLayer` labels only the strongest `labelCount` fires by brightness; the
  full `THREE.Points` cloud is unlabelled). The label text (detection time +
  brightness K + confidence) is built in `firesLayer`. These are ordinary
  depth-tested `labelSprite`s, so the opaque Earth hides far-side ones for free —
  no raycast/horizon math (the earlier hover-tooltip approach needed both).
- **FIRMS default source is `VIIRS_NOAA20_NRT`, not `VIIRS_SNPP_NRT`.** The
  Suomi-NPP NRT feed went intermittent and now returns ~0 rows for `world/1`;
  NOAA-20 (and NOAA-21) are the healthy operational VIIRS feeds. If the fires layer
  ever shows almost no points again, `curl` the source URLs and switch — it's a
  feed outage, not a parsing bug.
- **The ISS layer caches TLEs per CelesTrak group, not per group-combination**
  (`useTleSatellites`), under `space-radar:tle-group:<name>` keys. Caching by
  combination (the earlier design) re-fetched huge groups on every toggle —
  tripping CelesTrak's 403 rate-limit — and piled up unbounded localStorage
  entries (a `QuotaExceededError` on `setItem`). `writeCache` now also swallows
  quota/storage errors. CelesTrak's `stations` group is the whole "Space
  Stations" set (cargo ships + cubesats deployed from the ISS), not just
  ISS/CSS — hence the "Space stations & nearby" label.
- **A 3D scene's camera `far` must clear the far side of its star sphere at max
  zoom-out** (`camera distance + starfield radius`). The Solar System scene
  showed a grey disc because `far` (500) was less than 300 + 400.
- **Globe/solar-system labels and markers keep a constant on-screen *pixel*
  size** via `scaleLabelToScreen` (in `labelSprite.ts`) and `scaleMarker` (in
  `earthScene`), which rescale every frame to `px × worldPerPx × cameraDistance`
  where `worldPerPx = 2·tan(fov/2) / canvas.clientHeight`. Dividing by the
  canvas pixel height is the crucial part: the earlier `K × cameraDistance`
  scale was constant only as a *fraction* of the viewport, so labels/markers
  **grew on a larger canvas**. Fire
  points use `sizeAttenuation:false` (size in framebuffer px, so multiply by
  `renderer.getPixelRatio()`) for the same constant-size effect. Solar-system
  planet names are labels too (added alongside the moon labels).
- **FIRMS needs a separate MAP_KEY** (`src/api/firmsMapKey.ts`, now populated).
  Valid FIRMS requests **do** send `access-control-allow-origin: *`, so the fires
  layer works from the browser with no proxy — the earlier "no CORS" note was
  only the invalid-key **400 error page**, which omits the header. The layer
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
  `eonetLayer`'s `pickDiverse` then round-robins across **region+category**
  buckets (region via the exported `regionOf`), so both geography and type are
  spread — Europe/Asia/etc. show alongside the far more numerous US wildfires
  instead of being crowded out of the `maxEvents` slice.
- **The Scene view (`src/scene/`) is the whole UI** (the card-grid
  "Dashboard" was removed; its leftover `space-radar:layout:v1` /
  `space-radar:ui-mode:v1` localStorage keys are simply ignored). Scene state
  (`space-radar:scene:v1`: scene tab, enabled layers, per-layer settings,
  Earth style) is sanitized field by field (`sceneState.ts`). `EarthStage`
  owns one `createEarthScene` and mounts one render-less `LayerHost` per
  enabled layer (from `layers/registry.ts`), which runs the layer hook,
  `applyFrame`s into `scene.layer(id)` and on unmount `removeLayer`s. Hosts
  report `{loading,error,summary,legend}` upward **only when that changes**
  (keyed effect) — reporting every render would re-render the whole view on
  the ISS layer's per-second tick (and loop). The latest full layer state (for
  `describe()`) lives in a ref written **in an effect**: react-hooks v7's
  `react-hooks/refs` rule rejects ref reads/writes during render, so the
  inspector polls it from an effect too. The inspector's detail panels
  (`scene/panels.tsx`) are the components in `src/cards/`. `#app` is exactly
  `100dvh`. Phones (<700px,
  `matchMedia`, guarded for jsdom) get a bottom sheet instead of side panels.
  An open inspector panel in the sheet gets `.scene-sheet-panel` (fixed sheet
  height, the panel body is the *only* scroller) — nested scrollers there
  trapped touch scrolling so the × was unreachable; × (`closeDetails`) goes
  back to the inspector's list and never closes the sheet. The sheet's first tab
  reads "Layers" on every tab.
- **The Sun tab (`scene/SunStage.tsx`)** follows the same pattern as the
  other scenes (the old scrolling card grid is gone): the stage is one
  zoomable 2D SDO disk (plain `<img>` + an SVG overlay inside a CSS
  transform; pan/zoom math in `scene/sunView.ts`; wheel/pinch/drag,
  double-click fits, hover-routed `+`/`-`), the left panel has `sunLayers`
  (`sun-regions`, `sun-flares`, `sun-grid`; `SceneState.sunLayers`) plus a
  **Wavelength** radio group (`SceneState.sunWavelength`, `scene/sunImagery.ts`),
  the inspector shows "On the disk" plus the Sun panels (flares, wind, cycle)
  under "More", and the bottom strip is `XrayTimeline` (GOES 1–8 Å flux over
  24 h on a log scale with C+ flares marked; a click opens the flare list).
  Layers are `LayerDefinition<SunFrame>`; markers are in **Stonyhurst lat/lon,
  west positive, already rotated to now**, and `astro/sunDisk.ts` projects
  them using B0 and the apparent radius. Disk geometry: SDO's "latest" images
  are north-up and centred, so the disk radius in image px = angular radius ÷
  plate scale (AIA 2.4″/px, HMI 2.016″/px at 1024 px; HMI's measured limb at
  478 px matches exactly). SWPC sources (all CORS `*`, under the proxy's
  `json/` prefix): `solar_regions.json` (30 days of daily reports; **longitude
  is east-positive**, and **the positions for `observed_date` D are valid at
  D+1 00:00 UTC**, calibrated against 296 optical flare locations and the HMI
  sunspots; assuming D 00:00 put every ring a day of rotation too far west),
  `edited_events.json` (XRA = GOES flares with their region, listed once per
  GOES satellite, so the duplicates are merged; FLA = optical flares with a
  location), and `goes/primary/xrays-1-day.json`. SVG gotcha: `vector-effect:
  non-scaling-stroke` is **not inherited**, so set it on every shape; without
  it the limb circle got a stroke a third of the image wide.
- **Time cursor**: `TimeScrubber` (±7 d, playback speeds) sets `time` (null =
  live). Layers get it via `useLayer(settings, time)` + `useClock`; the globe's
  sun position and `SolarSystemCard` (new optional `time` prop on
  `CardComponentProps`) follow it. Snapshot feeds (quakes, EONET, fires…)
  ignore it. EPIC frames are *not* time-linked yet.
- **Asteroid flybys (`layers/neoFlybyLayer.ts`, `astro/flyby.ts`) are "level
  A" — schematic.** NeoWs gives only time, miss distance and speed per pass,
  so each pass is a straight line missing Earth by exactly the miss distance,
  in a direction hashed from the object id; distance is log-compressed
  (`compressDistance`: 1 R⊕ → globe surface, 0.2 AU → 14 units). The Moon is
  placed at its real sub-lunar direction on that scale with a ring for
  reference. Turning the layer on dollies the camera out (`setViewDistance`).
  NeoWs lists some objects twice (provisional "(2018 EH4)" + numbered
  "678976 (2018 EH4)", different ids) — `dedupeFlybys` keeps the numbered
  one. Level B (real geometry from `orbital_data`, which `fetchFlybys` already
  requests with `detailed=true`) is the post-release step.
- **`earthScene` auto-fits the camera distance to the canvas aspect** (the FOV
  is vertical, so a portrait phone canvas cut the globe off at the sides) until
  the distance no longer matches the last fit — i.e. until the user zooms.
- **Night lights** = a separate additive sphere just above the surface with a
  tiny ShaderMaterial (GIBS VIIRS Black Marble, loaded only when the layer is
  on), masked to the night side by the sun direction and thresholded on
  luminance so Black Marble's faint bluish land doesn't wash over the photo.
- **`useApiResource` dedups across components**: one in-flight request per
  key (dropped once settled or when its last waiter unmounts — else a hung
  request blocks the next mount, which broke tests), and a poll is skipped if
  another instance refreshed the cache within the last half poll interval.
  Resources shown in more than one place live in `hooks/sharedResources.ts`
  (Kp, solar wind, launches, people in space, NOAA scales) — **don't
  redefine their cache key/TTL in a component**.
- **Solar System (`render/solarSystemScene.ts`, `scene/SolarStage.tsx`).**
  Every body is textured: Sun/planets/Moon from Solar System Scope (CC BY 4.0,
  same source as the starfield; Earth reuses `earth-diffuse.jpg`), Galilean
  moons from public-domain NASA/JPL/USGS mosaics on Wikimedia Commons — all in
  `src/assets/planets/`, downscaled to 1024×512 (~1.7 MB total), loaded only
  when the tab mounts. The credit line is in the Solar System side panel and
  the README. Saturn has a ring mesh (`RingGeometry` with UVs remapped
  radially, since the ring texture is a radial strip). **Each body is turned on
  its real spin axis** via `astro/bodyOrientation.ts` (astronomy-engine
  `RotationAxis` → pole + prime-meridian vectors in the J2000 ecliptic frame);
  the mesh basis is (meridian, north, meridian×north) because SphereGeometry
  puts an equirectangular map's centre (lon 0) on +X. IAU "north" is the pole
  on the ecliptic-north side, so Uranus reads 82°, not 98° (retrograde shows as
  the spin direction). Galilean moons have no IAU model there and borrow
  Jupiter's axis; per-texture longitude conventions aren't calibrated, so the
  axis/spin rate are real but which face points at you is approximate.
  **Fly-to:** clicking a body or its label (or a `.body-chip` in the side
  panel; `SceneView` owns `solarFocus` and passes `focus`/`onFocusChange`)
  flies the camera to `radius × 5` (Saturn ×7 so the rings fit) and then
  follows the body by moving camera+target by its per-frame delta.
  `controls.minDistance` is relaxed during the flight (OrbitControls clamps
  every update, so flying out from a close-up would jump) and `camera.near` is
  re-derived each frame from the view distance so small moons aren't clipped.
  Labels sit just above their body in *screen* space (camera-up offset of
  radius + a few px), so they work at any zoom. Moon meshes are created once
  and moved, not rebuilt each update.
- **Solar System layers** (`layers/registry.ts` → `solarLayers`, hosted by
  `scene/SolarStage.tsx`, state in `SceneState.solarLayers` — a separate list
  so storage from before it existed gets them all on). Same
  `LayerDefinition` shape as Earth's, generic over the frame:
  `SolarLayerDefinition = LayerDefinition<SolarFrame>`, a frame being
  `{ markers, tracks }` in **true heliocentric ecliptic AU**; the scene
  (`scene.layer(id).setMarkers/setTracks`) applies the display transform.
  Status reporting is shared with `EarthStage` via `scene/layerHost.ts`.
  - `sol-asteroids`: the same NeoWs passes as the Earth flyby layer
    (`useFlybys`, shared cache key `space-radar:flybys:v2:*` — v2 because v1
    caches lack the parsed `elements`) on their real orbits.
  - `comets`: JPL SBDB query — "near perihelion" (tp within ±1 yr, q < 4 AU,
    sorted by M1) + `FAMOUS_COMETS`. Many new comets are hyperbolic (e > 1),
    so `astro/kepler.ts` solves ellipse, hyperbola and exact parabola from
    perihelion-form elements (q, e, i, Ω, ω, tp). Open/very long orbits are
    drawn as an arc within 12 AU — 40 AU arcs criss-crossed the whole view.
  - `spacecraft`: JPL Horizons vectors (Sun-centred, ecliptic, AU) for a year
    back + 2 weeks ahead, step 1–4 d per craft, linearly interpolated;
    coverage edges ("No ephemeris … after A.D. …", e.g. Hera's) are retried
    inside the range. Ids checked against Horizons in Oct 2026.
  Beyond 35 AU distances are **log-compressed** (`displayRadiusAu`: Voyager
  1's 172 AU → ~62 AU on screen); planets (≤ 30 AU) are exact. Markers are
  constant-pixel spheres/diamonds; their names show only near the camera
  unless `labelAlways` (spacecraft). Clicking a marker = fly-to + inspector
  details (the scene's `SolarFocus` carries layer/marker ids); `focusBody` on
  a marker not loaded yet is kept pending until its layer delivers it.
  Planets are drawn hundreds of times too large relative to distances, so a
  very close asteroid pass can sit inside Earth's ball — the layer says so.
- ESLint bans `as` type assertions (`@typescript-eslint/consistent-type-assertions:
  'never'`). Narrow `unknown` with a type-predicate helper
  (`function isRecord(v): v is Record<string, unknown>`) instead of casting.
  `src/api/cache.ts`'s `readCache<T>` takes a validator predicate
  (`isValue: (v: unknown) => v is T`) rather than casting its return value —
  follow that pattern for any new cached resource.

## Gotchas learned while building this

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
- **Playwright drags need a real multi-step `mouse.move`** (`{ steps: N }`),
  not a single jump — a one-shot move can leave a half-registered gesture.
