# Space Radar

**A space situational awareness dashboard.** A web app that pulls live data
from public space agencies — satellite orbits, planetary positions, space
weather, solar flares/CMEs, near-Earth asteroids, natural events, rocket
launches and active fires — into a grid of cards you can show, hide, drag and
resize. Your layout is saved locally, so the dashboard looks the same next time
you open it.

## Features

- **ISS & Satellites** — 3D Earth (Three.js) showing the ISS plus satellites
  from selectable CelesTrak groups (stations, Starlink, GPS, weather, …), each
  labelled by name with a fading orbit trail, propagated client-side via SGP4
  (`satellite.js`).
- **Solar System** — 3D view of the Sun, the eight planets, and the large moons
  (Earth's Moon and Jupiter's four Galilean moons), positions computed
  client-side (no network) via `astronomy-engine`.
- **Geomagnetic Activity (Kp-index)** — bar chart of recent planetary Kp
  readings from NOAA SWPC with a time axis, colour-coded by storm severity.
- **Solar Wind** — speed and density mini-charts (with a time axis) from NOAA's
  propagated solar-wind product.
- **Aurora Forecast** — NOAA OVATION aurora oval image, refreshed periodically.
- **Solar Flares & CME** — recent X-ray flares from NOAA SWPC GOES plus
  coronal-mass-ejection events from NASA DONKI (best-effort).
- **Near-Earth Asteroids** — sortable table of close approaches from NASA NeoWs.
- **Natural Events** — wildfires, volcanoes, storms and more from NASA EONET,
  plotted on a 3D globe with a category legend.
- **Upcoming Launches** — the next orbital launches from Launch Library 2.
- **Astronomy Picture of the Day** — NASA APOD image with its caption.
- **Active Fires** — VIIRS/MODIS fire detections from NASA FIRMS as a point
  cloud on a 3D globe (needs a free FIRMS MAP_KEY — see below).
- Every card can be shown or hidden from the **Cards** menu, dragged/resized on
  the grid, opened full-screen, or tuned via its **⚙ settings** popup (size in
  rows/columns plus card-specific options). Layout and settings are saved to
  `localStorage` and restored on reload; **Reset layout** returns the defaults.

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run check     # tsc + eslint + vitest
npm run smoke     # headless-Chromium smoke: visibility, drag, resize,
                   # localStorage persistence, reset — no console errors
npm run snap      # flexible single debug screenshot, e.g.
                   #   npm run snap -- --out /tmp/x.png --show solar-system
npm run shot      # one screenshot per card → ./shots
npm run build     # production build → ./docs (GitHub Pages)
```

## Architecture

```
src/api/       fetch + parse for each data source (CelesTrak, NOAA SWPC + GOES,
               NASA DONKI/NeoWs/EONET/APOD/FIRMS, Launch Library 2) — pure
               functions, no React/Three
src/astro/     pure orbital/astronomical math: TLE -> geodetic position
               (satellite.js), planet + moon vectors (astronomy-engine),
               lat/lon/AU -> 3D scene coordinates. Never imports Three.js.
src/render/    thin Three.js layer: Earth globe + solar-system scenes, plus
               starfield / label-sprite / orbit-trail helpers
src/hooks/     useApiResource — generic polling + localStorage TTL cache
src/layout/    card registry, grid/visibility/settings state, react-grid-layout
               wiring, per-card settings popup
src/cards/     one React component per card
```

`src/astro/` never imports Three.js and `src/api/` never imports React — the
same core/UI separation used in the sibling `mathsculpt` project. Three.js
scenes can't run in `jsdom` (no WebGL), so `render/` and the mounting effects
in the four WebGL cards are exercised by `scripts/smoke.mjs` in a real browser
rather than by `vitest`.

## Data sources

| Source | Used for | Key |
|---|---|---|
| [CelesTrak](https://celestrak.org/) | satellite TLEs | none |
| [NOAA SWPC](https://www.swpc.noaa.gov/) | Kp-index, solar wind, aurora | none |
| [NOAA SWPC GOES](https://www.swpc.noaa.gov/) | solar flares (X-ray events) | none |
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | CMEs (best-effort) | personal key |
| [NASA NeoWs](https://api.nasa.gov/) | near-Earth asteroids | personal key |
| [NASA EONET](https://eonet.gsfc.nasa.gov/) | natural events (wildfires, volcanoes, …) | none |
| [Launch Library 2](https://thespacedevs.com/llapi) | upcoming rocket launches | none |
| [NASA APOD](https://api.nasa.gov/) | astronomy picture of the day | personal key |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/) | active fire detections (VIIRS/MODIS) | MAP_KEY |

The starfield background in the 3D cards is the Milky Way panorama texture
from [Solar System Scope](https://www.solarsystemscope.com/textures/)
(CC BY 4.0).

The favicon (`public/favicon.svg`) is a self-contained SVG radar scope in the
app's palette. It lives in `public/` (copied verbatim to `docs/` on build) and
is referenced from `index.html` with a relative `./favicon.svg` path so it
resolves under the GitHub Pages sub-path.

FIRMS uses a separate free MAP_KEY (not the `api.nasa.gov` key) — get one at
[firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key/)
and paste it into `src/api/firmsMapKey.ts`. Valid FIRMS requests send
`Access-Control-Allow-Origin: *`, so the Fire Map card works directly from the
browser — no proxy needed. (Only the invalid-key **400** error page omits the
CORS header.)

The NASA key lives in `src/api/nasaApiKey.ts` (1000 requests/hour, no daily
cap — a big step up from the shared `DEMO_KEY`'s 30/hour). This is a
client-only static site with no backend, so — same as `DEMO_KEY` before it —
the key ships in the public JS bundle; that's expected for `api.nasa.gov`
keys, which only rate-limit by caller and aren't tied to billing or account
access. Get your own free key at [api.nasa.gov](https://api.nasa.gov/) if you
fork this.
