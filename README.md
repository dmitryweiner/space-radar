# Space Radar

**A space situational awareness dashboard.** A web app that pulls live data
from public space agencies — satellite orbits, planetary positions, space
weather, solar flares/CMEs, near-Earth asteroids — into a grid of cards you
can show, hide, drag and resize. Your layout is saved locally, so the
dashboard looks the same next time you open it.

## Features

- **ISS & Satellites** — 3D Earth (Three.js) with the ISS marker and its
  next-orbit ground track, propagated client-side from a CelesTrak TLE via
  SGP4 (`satellite.js`).
- **Solar System** — 3D top-down view of the Sun and eight planets, positions
  computed client-side (no network) via `astronomy-engine`.
- **Geomagnetic Activity (Kp-index)** — bar chart of recent planetary
  Kp readings from NOAA SWPC, colour-coded by storm severity.
- **Solar Wind** — speed and density mini-charts from NOAA's propagated
  solar-wind product.
- **Aurora Forecast** — NOAA OVATION aurora oval image, refreshed
  periodically.
- **Solar Flares & CME** — recent flare and coronal-mass-ejection events from
  NASA DONKI.
- **Near-Earth Asteroids** — sortable table of close approaches from NASA
  NeoWs.
- Every card can be shown or hidden from the **Cards** menu; the grid
  position/size of every card is saved to `localStorage` and restored on
  reload. **Reset layout** returns everything to the defaults.

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
src/api/       fetch + parse for each data source (CelesTrak, NOAA SWPC,
               NASA DONKI, NASA NeoWs) — pure functions, no React/Three
src/astro/     pure orbital/astronomical math: TLE -> geodetic position
               (satellite.js), planet heliocentric vectors (astronomy-engine),
               lat/lon/AU -> 3D scene coordinates. Never imports Three.js.
src/render/    thin Three.js layer: Earth globe scene, solar system scene
src/hooks/     useApiResource — generic polling + localStorage TTL cache
src/layout/    card registry, grid/visibility state, react-grid-layout wiring
src/cards/     one React component per card
```

`src/astro/` never imports Three.js and `src/api/` never imports React — the
same core/UI separation used in the sibling `mathsculpt` project. Three.js
scenes can't run in `jsdom` (no WebGL), so `render/` and the mounting effects
in the two 3D cards are exercised by `scripts/smoke.mjs` in a real browser
rather than by `vitest`.

## Data sources

| Source | Used for | Key |
|---|---|---|
| [CelesTrak](https://celestrak.org/) | satellite TLEs | none |
| [NOAA SWPC](https://www.swpc.noaa.gov/) | Kp-index, solar wind, aurora | none |
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | flares, CMEs | personal key |
| [NASA NeoWs](https://api.nasa.gov/) | near-Earth asteroids | personal key |

The NASA key lives in `src/api/nasaApiKey.ts` (1000 requests/hour, no daily
cap — a big step up from the shared `DEMO_KEY`'s 30/hour). This is a
client-only static site with no backend, so — same as `DEMO_KEY` before it —
the key ships in the public JS bundle; that's expected for `api.nasa.gov`
keys, which only rate-limit by caller and aren't tied to billing or account
access. Get your own free key at [api.nasa.gov](https://api.nasa.gov/) if you
fork this.
