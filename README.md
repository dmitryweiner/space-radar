# Space Radar

**A space situational awareness dashboard.** A web app that pulls live data
from public space agencies — satellite orbits, planetary positions, space
weather, solar flares/CMEs, the solar cycle, near-Earth asteroids, earthquakes,
natural events, rocket launches, active fires, the Moon and eclipses, and
full-disk Earth and Sun imagery — into a grid of cards you can show, hide, drag
and resize. Your layout is saved locally, so the dashboard looks the same next
time you open it.

## Features

- **ISS & Satellites** — 3D Earth (Three.js) showing the ISS plus satellites
  from selectable CelesTrak groups (stations, Starlink, GPS, weather, …), each
  labelled by name with a fading orbit trail, propagated client-side via SGP4
  (`satellite.js`).
- **Solar System** — 3D view of the Sun, the eight planets, and the large moons
  (Earth's Moon and Jupiter's four Galilean moons) sized by their real relative
  diameters, positions computed client-side (no network) via `astronomy-engine`.
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
  cloud on a 3D globe, with the strongest fires labelled (time + brightness);
  needs a free FIRMS MAP_KEY — see below.
- **Earth from L1 (EPIC)** — a day's worth of full-disk Earth photos from the
  DSCOVR/EPIC camera at the L1 point, with a play/scrub slider so you can watch
  the planet rotate.
- **Earthquakes (USGS)** — recent quakes on a 3D globe, coloured and sized by
  magnitude, from selectable USGS feeds (magnitude threshold × time window).
- **Live Sun (SDO)** — latest full-disk Sun images from NASA SDO in selectable
  wavelengths (corona, chromosphere, sunspots, magnetogram) plus a live GOES-19
  Earth disk, refreshed every ~15 minutes.
- **Solar Cycle** — sunspot-number history and the official SWPC forecast on one
  chart, with a "now" marker showing where the current cycle stands.
- **Moon & Eclipses** — current Moon phase (rendered icon + illuminated
  percentage), distance, and the next perigee/apogee and lunar/solar eclipses —
  computed entirely offline via `astronomy-engine`.
- **Aurora Oval (3D)** — the NOAA OVATION aurora probability oval drawn as a
  glowing point cloud on a 3D globe.
- **NASA Image Library** — a browsable pick of images from the NASA image
  archive across selectable topics (nebulae, galaxies, Apollo, planets, …).
- The 3D cards (globes and the Solar System) can be **rotated by dragging** and
  **zoomed** with the mouse wheel or the `+`/`-` keys (the keys zoom whichever
  card the pointer is hovering, even while a globe is still spinning).
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
               NASA DONKI/NeoWs/EONET/APOD/FIRMS/EPIC/Images, USGS quakes,
               Launch Library 2) — pure functions, no React/Three
src/astro/     pure orbital/astronomical math: TLE -> geodetic position
               (satellite.js), planet + moon vectors, Moon phase / apsides /
               eclipses (astronomy-engine), lat/lon/AU -> 3D scene coordinates.
               Never imports Three.js.
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
in the six WebGL cards are exercised by `scripts/smoke.mjs` in a real browser
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
| [NASA EPIC](https://epic.gsfc.nasa.gov/) | full-disk Earth images from DSCOVR/L1 | none |
| [USGS Earthquakes](https://earthquake.usgs.gov/earthquakes/feed/v1.0/) | realtime earthquake feeds | none |
| [NASA SDO](https://sdo.gsfc.nasa.gov/) / [NOAA GOES](https://www.star.nesdis.noaa.gov/GOES/) | live Sun / Earth images | none |
| [NOAA SWPC solar cycle](https://www.swpc.noaa.gov/products/solar-cycle-progression) | observed + predicted sunspot number / F10.7 | none |
| [NOAA SWPC OVATION](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast) | aurora probability grid | none |
| `astronomy-engine` (offline) | Moon phase, apsides, eclipses | none |
| [NASA Images](https://images.nasa.gov/) | NASA image & video library search | none |

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
