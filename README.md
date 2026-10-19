# [Space Radar](https://dmitryweiner.github.io/space-radar/)

<img width="600" alt="image" src="https://github.com/user-attachments/assets/d29114fa-af54-4924-a1ff-2d55a2702f6e" />

**A space situational awareness dashboard.** A web app that pulls live data
from public space agencies — satellite orbits, planetary positions, space
weather, solar flares/CMEs, the solar cycle, near-Earth asteroids, earthquakes,
natural events, rocket launches, active fires, fireballs, the Moon and
eclipses, and full-disk Earth and Sun imagery — into one interactive **Scene**.
Your choices are saved locally.

## Scene

- **One globe, many layers.** Satellites & the ISS, the aurora oval,
  earthquakes, natural events, active fires, asteroid flybys, fireballs and
  night lights are toggleable **layers on a single Earth**, so you can see how
  they relate (where is the ISS relative to the aurora?). Each layer has its own
  ⚙ settings; the Earth surface can be the photo globe, a ~2-day-old **NASA
  GIBS satellite mosaic**, or a flat map. The day/night terminator is the
  **real one**, computed for the current (or scrubbed) time.
  - **ISS & satellites** — the ISS plus satellites from selectable CelesTrak
    groups (stations, Starlink, GPS, weather, …), each labelled with a fading
    orbit trail, propagated client-side via SGP4 (`satellite.js`).
  - **Earthquakes** — USGS feeds (magnitude threshold × time window), coloured
    and sized by magnitude.
  - **Natural events** — wildfires, volcanoes, storms and more from NASA EONET,
    spread across regions and categories.
  - **Active fires** — VIIRS/MODIS detections from NASA FIRMS, strongest fires
    labelled (needs a free FIRMS MAP_KEY — see below).
  - **Aurora oval** — NOAA OVATION probability grid as a glowing point cloud.
- **Time scrubber** (±7 days, with playback at 1 min/s … 1 day/s): satellites,
  the terminator, night lights, the Moon, asteroid flybys and the Solar System
  all follow it. "Live" returns to now.
- **Asteroid flybys** — every close approach within ±N days (NASA NeoWs) drawn
  as a pass by Earth at its real miss distance and timing, on a compressed
  distance scale with the Moon's orbit for reference. Directions are schematic
  (NeoWs gives no geometry), and the layer says so.
- **Inspector** (right): click any marker for details; otherwise legends, the
  Moon, the Sun right now, and detail panels — Kp-index and solar-wind charts,
  solar flares & CMEs, the aurora forecast image, upcoming launches, today's
  near-Earth asteroids, the Moon & eclipses, the solar cycle, EPIC full-disk
  Earth photos from L1, APOD, the Sun in other wavelengths (SDO), and the NASA
  image library.
- **Status bar**: NOAA R/S/G space-weather scales, Kp, solar-wind speed, people
  in space, next launch — click a chip for details.
- Scenes: **Earth**, **Sun** (SDO) and **Solar System**.
- **Solar System** — the Sun, the eight planets, Earth's Moon and Jupiter's
  four Galilean moons with **real surface maps**, sized by their real relative
  diameters and each turned on its **real spin axis** (Saturn's rings tilt,
  Uranus lies on its side), positions computed offline via `astronomy-engine`.
  Click a body (or its name, or a chip in the side panel) to fly to it; the
  camera follows it as time moves.
  Toggleable layers there:
  - **Spacecraft** — 13 active deep-space missions (Voyagers, New Horizons,
    Parker Solar Probe, Europa Clipper, JUICE, Psyche, Lucy, JWST, …) at
    their real positions from **JPL Horizons**, with fading trails; distance
    from the Sun and Earth, light time and speed in the inspector.
  - **Asteroid flybys** — this week's closest Earth passes (NASA NeoWs) on
    their **real orbits** from JPL orbital elements.
  - **Comets** — comets near perihelion now plus famous periodic ones (Halley,
    Encke, 67P, Swift–Tuttle, …) from the **JPL Small-Body Database**,
    including hyperbolic one-time visitors.
  Beyond 35 AU the distance scale is compressed so the Voyagers fit on screen.
- The 3D views **rotate by dragging** and **zoom** with the mouse wheel,
  trackpad pinch, or `+`/`-`. The globe idle-spins until you drag it — zooming
  never stops the spin. **Settings** in the header: label/marker size and
  auto-rotate speed (0 turns it off).
- On phones the globe is full screen (one finger rotates it — the page doesn't
  scroll), layers and details live in a bottom sheet, and the status chips
  scroll sideways.

## Development

```bash
npm install
npm run dev       # Vite dev server
npm run check     # tsc + eslint + vitest
npm run smoke     # headless-Chromium smoke of the Scene: layers, scrubber,
                   # tabs, zoom/rotate, settings, phone — no console errors
npm run snap      # flexible single debug screenshot, e.g.
                   #   npm run snap -- --out /tmp/x.png --tab 'Solar System'
npm run build     # production build → ./dist (CI deploys it to GitHub Pages)
npm run worker:deploy   # deploy the caching proxy (worker/) to Cloudflare
npm run worker:tail     # live proxy logs
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
               (requests deduped across components); sharedResources
src/layers/    one LayerDefinition per geographic source: settings + a
               useLayer(settings, time) hook returning what to draw
src/scene/     the Scene view: globe stage, layer panel, inspector, status
               bar, time scrubber, persisted scene state
src/settings/  setting types/readers, form fields, general settings popup
src/cards/     self-contained panels shown in the inspector (charts, lists,
               images) plus the Solar System scene component
worker/        Cloudflare Worker: caching proxy over an allowlist of the
               upstream APIs (see backend-plan.md)
```

All API traffic goes through the **caching proxy** first (one shared cache
for every visitor: stale-while-revalidate, last good copy on upstream errors,
API keys kept as worker secrets) and falls back to calling the upstream
directly if the proxy is unavailable. JPL data (fireballs) has no CORS, so it
works only through the proxy.

`src/astro/` never imports Three.js and `src/api/` never imports React — the
same core/UI separation used in the sibling `mathsculpt` project. Three.js
scenes can't run in `jsdom` (no WebGL), so `render/` and the components that
mount it are exercised by `scripts/smoke.mjs` in a real browser rather than by
`vitest`.

## Data sources

| Source | Used for | Key |
|---|---|---|
| [CelesTrak](https://celestrak.org/) | satellite TLEs | none |
| [NOAA SWPC](https://www.swpc.noaa.gov/) | Kp-index, solar wind, aurora | none |
| [NOAA SWPC GOES](https://www.swpc.noaa.gov/) | solar flares (X-ray events) | none |
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | CMEs (best-effort) | personal key |
| [NASA NeoWs](https://api.nasa.gov/) | near-Earth asteroids and their orbital elements | personal key |
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
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/) | daily VIIRS true-colour mosaic, Black Marble night lights | none |
| [NOAA SWPC scales](https://www.swpc.noaa.gov/noaa-scales-explanation) | R/S/G space-weather scales | none |
| [Launch Library 2 astronauts](https://thespacedevs.com/llapi) | people in space | none |
| [JPL Fireball API](https://ssd-api.jpl.nasa.gov/doc/fireball.html) | bolides with location and energy (via the proxy) | none |
| [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | spacecraft trajectories (via the proxy) | none |
| [JPL SBDB Query](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | comet orbital elements (via the proxy) | none |

The starfield background and the Sun/planet/Moon surface maps in the Solar
System are textures from
[Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0),
downscaled to 1024×512. The Galilean moon maps are public-domain NASA/JPL/USGS
mosaics via Wikimedia Commons
([Io](https://commons.wikimedia.org/wiki/File:Io_for_GeoHacks.jpg),
[Europa](https://commons.wikimedia.org/wiki/File:Europa_Voyager_GalileoSSI_global_mosaic.jpg),
[Ganymede](https://commons.wikimedia.org/wiki/File:Ganymede_map_NASA_JPL_Voyager.jpg),
[Callisto](https://commons.wikimedia.org/wiki/File:Callisto_map_NASA_JPL_Voyager.jpg)).

The flat "map" Earth style (an alternative to the default photographic globe,
selectable in the layer panel) uses a blank political world map from
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Blank_Map_of_The_World_Equirectangular_Projection.png)
by FelixCountryBalls163 (CC BY 4.0), downscaled to 2048×1024.

The favicon (`public/favicon.svg`) is a self-contained SVG radar scope in the
app's palette. It lives in `public/` (copied verbatim to `dist/` on build) and
is referenced from `index.html` with a relative `./favicon.svg` path so it
resolves under the GitHub Pages sub-path.

FIRMS uses a separate free MAP_KEY (not the `api.nasa.gov` key) — get one at
[firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key/)
and paste it into `src/api/firmsMapKey.ts`. Valid FIRMS requests send
`Access-Control-Allow-Origin: *`, so the fires layer works directly from the
browser — no proxy needed. (Only the invalid-key **400** error page omits the
CORS header.)

The NASA key lives in `src/api/nasaApiKey.ts` (1000 requests/hour, no daily
cap — a big step up from the shared `DEMO_KEY`'s 30/hour). This is a
client-only static site with no backend, so — same as `DEMO_KEY` before it —
the key ships in the public JS bundle; that's expected for `api.nasa.gov`
keys, which only rate-limit by caller and aren't tied to billing or account
access. Get your own free key at [api.nasa.gov](https://api.nasa.gov/) if you
fork this.
