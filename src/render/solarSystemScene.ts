import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HeliocentricVector, PlanetPosition } from '../astro/planetPositions';
import type { MoonPosition } from '../astro/moonPositions';
import type { BodyOrientation } from '../astro/bodyOrientation';
import { heliocentricToSceneVector } from '../astro/coords';
import { createStarfield } from './starfield';
import { makeLabelSprite, scaleLabelToScreen, type LabelSprite } from './labelSprite';
import { attachAutoRotate, attachKeyboardZoom } from './orbitControlsExtras';
import { makeTrail, type TrailLine } from './trailLine';
import { compressForDisplay } from '../astro/kepler';
import earthTextureUrl from '../assets/earth-diffuse.jpg';
import sunTextureUrl from '../assets/planets/sun.jpg';
import mercuryTextureUrl from '../assets/planets/mercury.jpg';
import venusTextureUrl from '../assets/planets/venus.jpg';
import marsTextureUrl from '../assets/planets/mars.jpg';
import jupiterTextureUrl from '../assets/planets/jupiter.jpg';
import saturnTextureUrl from '../assets/planets/saturn.jpg';
import saturnRingTextureUrl from '../assets/planets/saturn-ring.png';
import uranusTextureUrl from '../assets/planets/uranus.jpg';
import neptuneTextureUrl from '../assets/planets/neptune.jpg';
import moonTextureUrl from '../assets/planets/moon.jpg';
import ioTextureUrl from '../assets/planets/io.jpg';
import europaTextureUrl from '../assets/planets/europa.jpg';
import ganymedeTextureUrl from '../assets/planets/ganymede.jpg';
import callistoTextureUrl from '../assets/planets/callisto.jpg';
import phobosTextureUrl from '../assets/planets/phobos.jpg';
import deimosTextureUrl from '../assets/planets/deimos.jpg';
import mimasTextureUrl from '../assets/planets/mimas.jpg';
import enceladusTextureUrl from '../assets/planets/enceladus.jpg';
import tethysTextureUrl from '../assets/planets/tethys.jpg';
import dioneTextureUrl from '../assets/planets/dione.jpg';
import rheaTextureUrl from '../assets/planets/rhea.jpg';
import iapetusTextureUrl from '../assets/planets/iapetus.jpg';
import { createFrameGate, pixelRatioFor } from './lowPower';

const UNITS_PER_AU = 6;

// Real equatorial radii (km). Planet bodies are sized from these so their
// relative diameters are correct — Jupiter dwarfs Mercury, Earth edges out
// Venus — instead of every planet being an identical blob.
const BODY_RADII_KM: Record<string, number> = {
  Sun: 696000,
  Mercury: 2439.7,
  Venus: 6051.8,
  Earth: 6371,
  Mars: 3389.5,
  Jupiter: 69911,
  Saturn: 58232,
  Uranus: 25362,
  Neptune: 24622,
  // Moons share the same scale — they are not a special size category. (Note
  // Ganymede is larger than Mercury, and both edge out the Moon/Io/Europa.)
  Moon: 1737.4,
  Io: 1821.6,
  Europa: 1560.8,
  Ganymede: 2634.1,
  Callisto: 2410.3,
  Phobos: 11.08,
  Deimos: 6.2,
  Mimas: 198.2,
  Enceladus: 252.1,
  Tethys: 531.1,
  Dione: 561.4,
  Rhea: 763.8,
  Titan: 2574.7,
  Iapetus: 734.5,
};

// Equirectangular surface maps. Planets, the Sun and the Moon: Solar System
// Scope (CC BY 4.0, from NASA mission data); Venus shows its cloud tops, the
// gas giants their cloud bands. Galilean moons: NASA/JPL/USGS Voyager +
// Galileo mosaics (public domain); Saturn's moons: NASA/JPL/Space Science
// Institute Cassini colour mosaics (public domain); Phobos/Deimos: maps by
// Askaniy on Wikimedia Commons (CC BY-SA 3.0). Titan has none — its haze hides
// the surface in visible light, so it's a flat colour. All 1024×512.
const BODY_TEXTURES: Record<string, string> = {
  Sun: sunTextureUrl,
  Mercury: mercuryTextureUrl,
  Venus: venusTextureUrl,
  Earth: earthTextureUrl,
  Mars: marsTextureUrl,
  Jupiter: jupiterTextureUrl,
  Saturn: saturnTextureUrl,
  Uranus: uranusTextureUrl,
  Neptune: neptuneTextureUrl,
  Moon: moonTextureUrl,
  Io: ioTextureUrl,
  Europa: europaTextureUrl,
  Ganymede: ganymedeTextureUrl,
  Callisto: callistoTextureUrl,
  Phobos: phobosTextureUrl,
  Deimos: deimosTextureUrl,
  Mimas: mimasTextureUrl,
  Enceladus: enceladusTextureUrl,
  Tethys: tethysTextureUrl,
  Dione: dioneTextureUrl,
  Rhea: rheaTextureUrl,
  Iapetus: iapetusTextureUrl,
};

// One shared exaggeration factor keeps the planets in true proportion to each
// other while staying visible. True-to-orbit scale is impossible here: orbital
// distances are real (UNITS_PER_AU), and at that scale a real-diameter Earth
// would be ~3e-4 units — sub-pixel. (Same reason moons ride display orbits.)
// Factor is set so Jupiter ≈ 1.3 units.
const PLANET_RADIUS_UNITS_PER_KM = 1.3 / 69911;
// Floor so the smallest bodies (inner planets and moons) stay visible; kept low
// enough that real differences among them still show — e.g. Ganymede > Mercury >
// Callisto > Io > Moon > Europa. Labels are always drawn, so nothing is lost.
const MIN_PLANET_RADIUS = 0.03;
// The Sun is ~10× Jupiter's diameter; on the planet scale it would be ~14 units
// and engulf Mercury's orbit (~2.3 units), so it gets its own compressed size —
// still clearly the largest body, but leaving the inner planets in the clear.
const SUN_RADIUS_UNITS = 1.8;

// Saturn's main rings (C ring inner edge → A ring outer edge), in planet radii.
const SATURN_RING_INNER = 1.24;
const SATURN_RING_OUTER = 2.27;

function bodyRadiusUnits(name: string): number {
  if (name === 'Sun') {
    return SUN_RADIUS_UNITS;
  }
  const km = BODY_RADII_KM[name] ?? BODY_RADII_KM.Earth;
  return Math.max(MIN_PLANET_RADIUS, km * PLANET_RADIUS_UNITS_PER_KM);
}

// Moons sit far too close to their planet to see at true scale, so they're
// drawn on exaggerated display orbits that start just outside the planet body
// (Saturn's: outside its rings). Real direction kept, in the moon's orbit
// plane when the ephemeris gives one, otherwise flattened into the ecliptic.
const MOON_ORBIT_GAP = 0.35;
const SATURN_MOON_ORBIT_GAP = 0.25;
const MOON_RADIUS_STEP = 0.4;
// Constant on-screen label sizes, in CSS pixels — unchanged by zoom or by
// the canvas size (see scaleLabelToScreen). Labels sit just above their body
// on screen, this many pixels clear of its edge.
const PLANET_LABEL_PX = 13;
const MOON_LABEL_PX = 11;
const LABEL_GAP_PX = 4;

// Overview camera: the whole system, orbiting the Sun. Zooming out far enough
// takes in the Voyagers (~370 units on the compressed outer scale).
const OVERVIEW_POSITION = new THREE.Vector3(0, 40, 60);
const OVERVIEW_MIN_DISTANCE = 10;
const MAX_DISTANCE = 550;
const STARFIELD_RADIUS = 900;
// Flying to a body: stop this many body radii away (Saturn further, so its
// rings fit), and don't let the wheel take the camera inside it.
const FOCUS_DISTANCE_RADII = 5;
const SATURN_FOCUS_DISTANCE_RADII = 7;
const FOCUS_MIN_DISTANCE_RADII = 1.4;
const FLY_MS = 900;
// A click (not a drag) within this many CSS px of a body — tiny bodies are a
// pixel or two wide at overview zoom — or on its label picks it.
const CLICK_SLOP_PX = 5;
const PICK_RADIUS_PX = 12;

// Layer markers (asteroids, comets, spacecraft): constant on-screen size like
// the labels. Their names show when the camera is near (or always, if the
// layer asks — e.g. a handful of spacecraft), so a cloud of asteroids by
// Earth doesn't bury the view in text.
const MARKER_PX = 4;
const MARKER_LABEL_PX = 11;
const MARKER_LABEL_NEAR_UNITS = 25;
const MARKER_FOCUS_DISTANCE = 3;
const MARKER_FOCUS_MIN_DISTANCE = 0.05;

const PLANET_COLORS: Record<string, number> = {
  Mercury: 0x9c9c9c,
  Venus: 0xd9b38c,
  Earth: 0x3987e5,
  Mars: 0xd95926,
  Jupiter: 0xc98500,
  Saturn: 0xe0c48a,
  Uranus: 0x9de0e0,
  Neptune: 0x4166f5,
  Titan: 0xd9a24e,
};

/** A point object from a layer: true heliocentric position (AU). */
export interface SolarMarker {
  id: string;
  position: HeliocentricVector;
  color: number;
  label: string;
  shape?: 'sphere' | 'diamond';
  /** Show the name at any zoom (default: only when the camera is near). */
  labelAlways?: boolean;
}

/** A polyline from a layer: an orbit, or a trail (`fade`: bright at the end). */
export interface SolarTrack {
  id: string;
  points: HeliocentricVector[];
  color: number;
  opacity?: number;
  closed?: boolean;
  fade?: boolean;
}

export interface SolarLayerHandle {
  setMarkers(markers: SolarMarker[]): void;
  /** Passing the same array again is a no-op. */
  setTracks(tracks: SolarTrack[]): void;
  setVisible(visible: boolean): void;
}

/** What the camera is following: a body (by name) or a layer's marker. */
export interface SolarFocus {
  key: string;
  label: string;
  layerId: string | null;
  markerId: string | null;
}

/** Focus key of a layer marker. */
export function markerFocusKey(layerId: string, markerId: string): string {
  return `${layerId}/${markerId}`;
}

export interface OrbitPath {
  name: string;
  points: HeliocentricVector[];
}

export interface SolarSystemSceneHandle {
  setPlanetPositions(positions: PlanetPosition[]): void;
  setOrbitPaths(paths: OrbitPath[]): void;
  setMoons(moons: MoonPosition[]): void;
  /** Spin-axis orientation per body name (Sun, planets, Moon). Moons without
   * an entry (the Galilean ones) take their planet's. */
  setOrientations(orientations: Record<string, BodyOrientation>): void;
  /** One group per data layer; created on first use. */
  layer(id: string): SolarLayerHandle;
  removeLayer(id: string): void;
  /** Fly the camera to a body (planet/moon name or markerFocusKey) and keep
   * following it; null or 'Sun' flies back to the whole-system overview.
   * No-op if already there. A marker that hasn't arrived yet is focused as
   * soon as its layer delivers it. */
  focusBody(key: string | null): void;
  /** Fires whenever the focus changes (a click, focusBody, or the focused
   * marker disappearing), and on every click on a body. */
  setOnFocusChange(handler: ((focus: SolarFocus | null) => void) | null): void;
  /** Multiplier on every label's and layer marker's on-screen pixel size
   * (the general "label size" setting). */
  setLabelScale(scale: number): void;
  /** Data saver: 30 fps cap and a 1× pixel ratio. */
  setLowPower(lowPower: boolean): void;
  /** Multiplies the idle auto-rotate speed (the global "Auto-rotate speed"
   * setting); 0 stops the spin. */
  setAutoRotateSpeed(multiplier: number): void;
  resize(): void;
  dispose(): void;
}

const RING_NORMAL = new THREE.Vector3(0, 1, 0);

function moonRingGeometry(radius: number): THREE.BufferGeometry {
  const segments = 48;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

// RingGeometry's default UVs are planar; the ring texture is a radial strip
// (inner edge on the left, outer on the right), so map u to the radius.
function saturnRingGeometry(planetRadius: number): THREE.RingGeometry {
  const inner = planetRadius * SATURN_RING_INNER;
  const outer = planetRadius * SATURN_RING_OUTER;
  const geometry = new THREE.RingGeometry(inner, outer, 128, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return geometry;
}

function planetColor(name: string): number {
  return PLANET_COLORS[name] ?? 0xffffff;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// True heliocentric AU → scene units, with the far outer system compressed.
function displayVector(v: HeliocentricVector, target: THREE.Vector3): THREE.Vector3 {
  const c = compressForDisplay(v);
  const s = heliocentricToSceneVector(c.xAu, c.yAu, c.zAu, UNITS_PER_AU);
  return target.set(s.x, s.y, s.z);
}

function toScene(v: HeliocentricVector, target: THREE.Vector3): THREE.Vector3 {
  const s = heliocentricToSceneVector(v.xAu, v.yAu, v.zAu, 1);
  return target.set(s.x, s.y, s.z);
}

function createOrbitLine(points: HeliocentricVector[]): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const vectors = points.map((p) => {
    const v = heliocentricToSceneVector(p.xAu, p.yAu, p.zAu, UNITS_PER_AU);
    return new THREE.Vector3(v.x, v.y, v.z);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(vectors);
  const material = new THREE.LineBasicMaterial({ color: 0x2f5a99, transparent: true, opacity: 0.4 });
  return new THREE.LineLoop(geometry, material);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

interface Body {
  /** Focus key: the body's name, or markerFocusKey for a layer marker. */
  name: string;
  title: string;
  mesh: THREE.Mesh;
  radius: number;
  label: LabelSprite | null;
  labelPx: number;
  /** Layer markers only: constant on-screen radius (radius is re-derived per frame). */
  markerPx?: number;
  labelAlways?: boolean;
  layerId?: string;
  markerId?: string;
}

interface LayerContent {
  group: THREE.Group;
  markers: Map<string, Body>;
  tracks: SolarTrack[] | null;
  trackObjects: { object: THREE.Line; trail: TrailLine | null }[];
}

interface MoonObject extends Body {
  planet: string;
  ring: THREE.LineLoop;
  orbitRadius: number;
}

export function createSolarSystemScene(canvas: HTMLCanvasElement): SolarSystemSceneHandle {
  const scene = new THREE.Scene();
  // far must clear the far side of the star sphere at max zoom-out
  // (MAX_DISTANCE + STARFIELD_RADIUS = 1450 < 2000), otherwise the
  // sphere's back hemisphere is clipped and shows as a grey disc. near is
  // re-set per frame (see updateNearPlane) so a close-up of a small moon
  // isn't clipped.
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.copy(OVERVIEW_POSITION);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(pixelRatioFor(false));
  const frameGate = createFrameGate();
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function applySize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  applySize();
  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(canvas);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = OVERVIEW_MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;
  const detachKeyboardZoom = attachKeyboardZoom(controls, camera, canvas);
  // Idle spin around whatever the camera looks at (the Sun, or a focused
  // body) until the user rotates/pans — same rules as the Earth globe.
  const autoRotate = attachAutoRotate(controls);
  // One finger rotates (the page never scrolls); two fingers rotate + pinch-zoom.
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

  const starfield = createStarfield(STARFIELD_RADIUS);
  scene.add(starfield.mesh);

  // Low ambient so the night sides read as night, but stay faintly visible.
  scene.add(new THREE.AmbientLight(0x8899bb, 0.45));
  scene.add(new THREE.PointLight(0xffffff, 3, 0, 0));

  const textureLoader = new THREE.TextureLoader();
  const textures: THREE.Texture[] = [];
  function loadTexture(url: string): THREE.Texture {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.push(texture);
    return texture;
  }
  const materials: THREE.Material[] = [];
  function bodyMaterial(name: string): THREE.MeshStandardMaterial {
    const url = BODY_TEXTURES[name];
    // Fall back to the old flat colour if a body ever lacks a map.
    const material = url
      ? new THREE.MeshStandardMaterial({ map: loadTexture(url), roughness: 1, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: planetColor(name) });
    materials.push(material);
    return material;
  }

  const sunMaterial = new THREE.MeshBasicMaterial({ map: loadTexture(sunTextureUrl) });
  materials.push(sunMaterial);
  const sun: Body = {
    name: 'Sun',
    title: 'Sun',
    mesh: new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS_UNITS, 48, 32), sunMaterial),
    radius: SUN_RADIUS_UNITS,
    label: null,
    labelPx: 0,
  };
  scene.add(sun.mesh);

  const planets = new Map<string, Body>();
  const orbitRings = new Map<string, THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>>();
  const moons = new Map<string, MoonObject>();
  const moonRingMaterial = new THREE.LineBasicMaterial({ color: 0x6f7fa6, transparent: true, opacity: 0.35 });
  materials.push(moonRingMaterial);
  let orientations: Record<string, BodyOrientation> = {};

  const scratch = new THREE.Vector3();
  const scratchPole = new THREE.Vector3();
  const scratchNorth = new THREE.Vector3();
  const scratchMeridian = new THREE.Vector3();
  const scratchEast = new THREE.Vector3();
  const scratchMatrix = new THREE.Matrix4();

  // Point the sphere's +Y at the body's north pole and its texture's
  // longitude 0 (the middle of an equirectangular map, which SphereGeometry
  // puts on +X) at the prime meridian, so it spins at its real rate and axial
  // tilt. Each map's own longitude convention isn't calibrated, so which
  // feature faces us is approximate — the axis and spin rate are real.
  function orient(mesh: THREE.Mesh, orientation: BodyOrientation | undefined) {
    if (!orientation) {
      return;
    }
    toScene(orientation.north, scratchNorth);
    toScene(orientation.meridian, scratchMeridian);
    scratchEast.crossVectors(scratchMeridian, scratchNorth);
    scratchMatrix.makeBasis(scratchMeridian, scratchNorth, scratchEast);
    mesh.quaternion.setFromRotationMatrix(scratchMatrix);
  }

  function orientAll() {
    orient(sun.mesh, orientations.Sun);
    for (const planet of planets.values()) {
      orient(planet.mesh, orientations[planet.name]);
    }
    for (const moon of moons.values()) {
      orient(moon.mesh, orientations[moon.name] ?? orientations[moon.planet]);
    }
  }

  const layers = new Map<string, LayerContent>();

  function markerBodies(): Body[] {
    const result: Body[] = [];
    for (const content of layers.values()) {
      if (content.group.visible) {
        result.push(...content.markers.values());
      }
    }
    return result;
  }

  function allBodies(): Body[] {
    return [sun, ...planets.values(), ...moons.values(), ...markerBodies()];
  }

  // ---- focus / fly-to -------------------------------------------------------

  let focused: Body | null = null;
  let onFocusChange: ((focus: SolarFocus | null) => void) | null = null;
  let pendingFocus: string | null = null;

  function notifyFocus() {
    onFocusChange?.(
      focused
        ? { key: focused.name, label: focused.title, layerId: focused.layerId ?? null, markerId: focused.markerId ?? null }
        : null,
    );
  }
  let flight: {
    start: number;
    fromTarget: THREE.Vector3;
    fromDistance: number;
    toDistance: number;
    minDistance: number;
  } | null = null;
  // Where the focused body was last frame — the camera moves by the same delta
  // to ride along when it moves (live tick or time scrubber).
  const followFrom = new THREE.Vector3();

  function flyTo(body: Body | null) {
    const target = body === null || body === sun ? null : body;
    // Already there (or on the way): following a body, or the overview still
    // centred on the Sun.
    if (target === focused && (flight || target !== null || controls.target.lengthSq() < 1e-9)) {
      return;
    }
    focused = target;
    pendingFocus = null;
    const fromDistance = camera.position.distanceTo(controls.target);
    let toDistance = OVERVIEW_POSITION.length();
    let minDistance = OVERVIEW_MIN_DISTANCE;
    if (target?.markerPx) {
      toDistance = MARKER_FOCUS_DISTANCE;
      minDistance = MARKER_FOCUS_MIN_DISTANCE;
    } else if (target) {
      toDistance = target.radius * (target.name === 'Saturn' ? SATURN_FOCUS_DISTANCE_RADII : FOCUS_DISTANCE_RADII);
      minDistance = target.radius * FOCUS_MIN_DISTANCE_RADII;
    }
    flight = {
      start: performance.now(),
      fromTarget: controls.target.clone(),
      fromDistance,
      toDistance,
      minDistance,
    };
    controls.enabled = false;
    // OrbitControls clamps to minDistance on every update — loosen it for the
    // flight so flying out from a close-up doesn't jump.
    controls.minDistance = Math.min(fromDistance, toDistance, flight.minDistance);
    if (target) {
      followFrom.copy(target.mesh.position);
    }
    notifyFocus();
  }

  function updateCamera(now: number) {
    if (flight) {
      const t = Math.min(1, (now - flight.start) / FLY_MS);
      const e = easeInOut(t);
      const goal = focused ? focused.mesh.position : scratch.set(0, 0, 0);
      const direction = camera.position.clone().sub(controls.target).normalize();
      controls.target.lerpVectors(flight.fromTarget, goal, e);
      const distance = flight.fromDistance + (flight.toDistance - flight.fromDistance) * e;
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      if (focused) {
        followFrom.copy(focused.mesh.position);
      }
      if (t >= 1) {
        controls.minDistance = flight.minDistance;
        controls.enabled = true;
        flight = null;
      }
    } else if (focused) {
      scratch.copy(focused.mesh.position).sub(followFrom);
      if (scratch.lengthSq() > 0) {
        controls.target.add(scratch);
        camera.position.add(scratch);
        followFrom.copy(focused.mesh.position);
      }
    }
  }

  function updateNearPlane() {
    const distance = camera.position.distanceTo(controls.target);
    const near = THREE.MathUtils.clamp(distance * 0.05, 0.002, 0.1);
    if (near !== camera.near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  // ---- picking --------------------------------------------------------------

  const raycaster = new THREE.Raycaster();
  raycaster.camera = camera;
  const pointerNdc = new THREE.Vector2();
  let pointerDown: { x: number; y: number } | null = null;

  function worldPerPixel(distance: number): number {
    return ((2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, canvas.clientHeight)) * distance;
  }

  function pick(clientX: number, clientY: number): Body | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const bodies = allBodies();
    // A body's own label is the easiest target at overview zoom.
    const labelled = bodies.filter((body) => body.label?.sprite.visible);
    const labelHits = raycaster.intersectObjects(labelled.map((body) => body.label?.sprite ?? body.mesh), false);
    if (labelHits.length > 0) {
      return labelled.find((body) => body.label?.sprite === labelHits[0].object) ?? null;
    }
    // Otherwise the nearest body (on screen) within a few pixels of its disc.
    let best: Body | null = null;
    let bestPx = Infinity;
    for (const body of bodies) {
      const distance = camera.position.distanceTo(body.mesh.position);
      scratch.copy(body.mesh.position).project(camera);
      if (scratch.z > 1) {
        continue;
      }
      const px = Math.hypot(
        ((scratch.x - pointerNdc.x) / 2) * rect.width,
        ((scratch.y - pointerNdc.y) / 2) * rect.height,
      );
      const radiusPx = body.radius / worldPerPixel(distance);
      const slack = px - Math.max(radiusPx, PICK_RADIUS_PX);
      if (slack <= 0 && px < bestPx) {
        best = body;
        bestPx = px;
      }
    }
    return best;
  }

  function handlePointerDown(event: PointerEvent) {
    pointerDown = { x: event.clientX, y: event.clientY };
  }

  function handleClick(event: MouseEvent) {
    const down = pointerDown;
    pointerDown = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > CLICK_SLOP_PX) {
      return;
    }
    const body = pick(event.clientX, event.clientY);
    if (!body) {
      return;
    }
    flyTo(body);
    // Again even when already focused: a second click re-opens its details.
    notifyFocus();
  }
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('click', handleClick);

  // ---- per frame ------------------------------------------------------------

  const cameraUp = new THREE.Vector3();
  let labelScale = 1;
  // Label just above its body on screen, whatever the zoom or view direction.
  function placeLabel(body: Body) {
    const distance = camera.position.distanceTo(body.mesh.position);
    const perPx = worldPerPixel(distance);
    if (body.markerPx) {
      body.radius = body.markerPx * labelScale * perPx;
      body.mesh.scale.setScalar(body.radius);
    }
    if (!body.label) {
      return;
    }
    body.label.sprite.visible = body.labelAlways === true || body === focused || distance < MARKER_LABEL_NEAR_UNITS || !body.markerPx;
    if (!body.label.sprite.visible) {
      return;
    }
    const labelPx = body.labelPx * labelScale;
    const lift = body.radius + (labelPx / 2 + LABEL_GAP_PX) * perPx;
    body.label.sprite.position.copy(body.mesh.position).addScaledVector(cameraUp, lift);
    scaleLabelToScreen(body.label, camera, canvas.clientHeight, labelPx);
  }

  let frameId = 0;
  // Real elapsed seconds for controls.update(), so the auto-rotate speed is
  // per second, not per frame (see earthScene.ts); capped so a stall (a
  // backgrounded tab) doesn't jump the view forward.
  const MAX_DELTA_SECONDS = 0.1;
  let lastFrameTime = performance.now();
  function animate(now: number) {
    frameId = requestAnimationFrame(animate);
    if (!frameGate.shouldRender(now)) {
      return;
    }
    const deltaSeconds = Math.min(Math.max(0, now - lastFrameTime) / 1000, MAX_DELTA_SECONDS);
    lastFrameTime = now;
    updateCamera(now);
    controls.update(deltaSeconds);
    updateNearPlane();
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (const planet of planets.values()) {
      placeLabel(planet);
    }
    for (const moon of moons.values()) {
      placeLabel(moon);
    }
    for (const body of markerBodies()) {
      placeLabel(body);
    }
    renderer.render(scene, camera);
  }
  frameId = requestAnimationFrame(animate);

  // ---- data layers ------------------------------------------------------------

  const markerGeometries = {
    sphere: new THREE.SphereGeometry(1, 12, 8),
    diamond: new THREE.OctahedronGeometry(1.4),
  };
  const markerMaterials = new Map<number, THREE.MeshBasicMaterial>();
  function markerMaterial(color: number): THREE.MeshBasicMaterial {
    let material = markerMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({ color });
      markerMaterials.set(color, material);
    }
    return material;
  }

  function disposeMarker(body: Body) {
    body.mesh.removeFromParent();
    body.label?.sprite.removeFromParent();
    body.label?.dispose();
  }

  function clearTracks(content: LayerContent) {
    for (const { object, trail } of content.trackObjects) {
      object.removeFromParent();
      if (trail) {
        trail.dispose();
      } else {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    }
    content.trackObjects = [];
  }

  function layerContent(layerId: string): LayerContent {
    let content = layers.get(layerId);
    if (!content) {
      content = { group: new THREE.Group(), markers: new Map(), tracks: null, trackObjects: [] };
      scene.add(content.group);
      layers.set(layerId, content);
    }
    return content;
  }

  // A focused marker that vanished (data refresh, layer off) drops the focus
  // where the camera is rather than yanking it back to the overview.
  function dropFocusIfGone() {
    if (focused?.markerPx && !markerBodies().includes(focused)) {
      focused = null;
      flight = null;
      controls.enabled = true;
      controls.minDistance = MARKER_FOCUS_MIN_DISTANCE;
      notifyFocus();
    }
  }

  function layerHandle(layerId: string): SolarLayerHandle {
    return {
      setMarkers(next) {
        const content = layerContent(layerId);
        const seen = new Set<string>();
        for (const marker of next) {
          seen.add(marker.id);
          let body = content.markers.get(marker.id);
          const shape = marker.shape ?? 'sphere';
          if (!body || body.mesh.geometry !== markerGeometries[shape] || body.title !== marker.label) {
            if (body) {
              disposeMarker(body);
            }
            const mesh = new THREE.Mesh(markerGeometries[shape], markerMaterial(marker.color));
            const label = makeLabelSprite(marker.label, hexToCss(marker.color));
            content.group.add(mesh, label.sprite);
            body = {
              name: markerFocusKey(layerId, marker.id),
              title: marker.label,
              mesh,
              radius: 0.01,
              label,
              labelPx: MARKER_LABEL_PX,
              markerPx: MARKER_PX,
              labelAlways: marker.labelAlways,
              layerId,
              markerId: marker.id,
            };
            content.markers.set(marker.id, body);
          }
          body.mesh.material = markerMaterial(marker.color);
          displayVector(marker.position, body.mesh.position);
        }
        for (const [id, body] of content.markers) {
          if (!seen.has(id)) {
            disposeMarker(body);
            content.markers.delete(id);
          }
        }
        if (pendingFocus) {
          const waiting = content.markers.get(pendingFocus.slice(layerId.length + 1));
          if (pendingFocus.startsWith(`${layerId}/`) && waiting) {
            flyTo(waiting);
          }
        }
        dropFocusIfGone();
      },
      setTracks(next) {
        const content = layerContent(layerId);
        if (content.tracks === next) {
          return;
        }
        content.tracks = next;
        clearTracks(content);
        for (const track of next) {
          const points = track.points.map((p) => displayVector(p, new THREE.Vector3()));
          if (track.fade) {
            const trail = makeTrail(track.color);
            trail.setPoints(points);
            content.group.add(trail.line);
            content.trackObjects.push({ object: trail.line, trail });
            continue;
          }
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({
            color: track.color,
            transparent: true,
            opacity: track.opacity ?? 0.5,
            depthWrite: false,
          });
          const object = track.closed ? new THREE.LineLoop(geometry, material) : new THREE.Line(geometry, material);
          content.group.add(object);
          content.trackObjects.push({ object, trail: null });
        }
      },
      setVisible(visible) {
        layerContent(layerId).group.visible = visible;
        dropFocusIfGone();
      },
    };
  }

  return {
    setLabelScale(scale) {
      labelScale = scale;
    },
    setLowPower(lowPower) {
      frameGate.setLowPower(lowPower);
      renderer.setPixelRatio(pixelRatioFor(lowPower));
      applySize();
    },
    setAutoRotateSpeed(multiplier) {
      autoRotate.setSpeed(multiplier);
    },
    layer(id) {
      return layerHandle(id);
    },
    removeLayer(id) {
      const content = layers.get(id);
      if (!content) {
        return;
      }
      for (const body of content.markers.values()) {
        disposeMarker(body);
      }
      clearTracks(content);
      scene.remove(content.group);
      layers.delete(id);
      dropFocusIfGone();
    },
    setPlanetPositions(positions) {
      for (const position of positions) {
        let planet = planets.get(position.name);
        if (!planet) {
          const radius = bodyRadiusUnits(position.name);
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), bodyMaterial(position.name));
          if (position.name === 'Saturn') {
            const ringMaterial = new THREE.MeshStandardMaterial({
              map: loadTexture(saturnRingTextureUrl),
              transparent: true,
              side: THREE.DoubleSide,
              depthWrite: false,
              roughness: 1,
              metalness: 0,
            });
            materials.push(ringMaterial);
            const ring = new THREE.Mesh(saturnRingGeometry(radius), ringMaterial);
            // RingGeometry lies in XY; the body's equator is its local XZ.
            ring.rotation.x = -Math.PI / 2;
            mesh.add(ring);
          }
          const label = makeLabelSprite(position.name, hexToCss(planetColor(position.name)));
          scene.add(mesh, label.sprite);
          planet = { name: position.name, title: position.name, mesh, radius, label, labelPx: PLANET_LABEL_PX };
          planets.set(position.name, planet);
          orient(mesh, orientations[position.name]);
        }
        const vector = heliocentricToSceneVector(position.xAu, position.yAu, position.zAu, UNITS_PER_AU);
        planet.mesh.position.set(vector.x, vector.y, vector.z);
      }
    },
    setOrbitPaths(paths) {
      for (const { name, points } of paths) {
        const existing = orbitRings.get(name);
        if (existing) {
          scene.remove(existing);
          existing.geometry.dispose();
          existing.material.dispose();
        }
        const ring = createOrbitLine(points);
        scene.add(ring);
        orbitRings.set(name, ring);
      }
    },
    setMoons(positions) {
      for (const position of positions) {
        const planet = planets.get(position.planet);
        if (!planet) {
          continue;
        }
        let moon = moons.get(position.name);
        if (!moon) {
          const radius = bodyRadiusUnits(position.name);
          const innerRadius =
            position.planet === 'Saturn' ? planet.radius * SATURN_RING_OUTER + SATURN_MOON_ORBIT_GAP : planet.radius + MOON_ORBIT_GAP;
          const orbitRadius = innerRadius + position.order * MOON_RADIUS_STEP;
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), bodyMaterial(position.name));
          const ring = new THREE.LineLoop(moonRingGeometry(orbitRadius), moonRingMaterial);
          const label = makeLabelSprite(position.name, '#cfd4e0');
          scene.add(mesh, ring, label.sprite);
          moon = {
            name: position.name,
            title: position.name,
            planet: position.planet,
            mesh,
            ring,
            orbitRadius,
            radius,
            label,
            labelPx: MOON_LABEL_PX,
          };
          moons.set(position.name, moon);
          orient(mesh, orientations[position.name] ?? orientations[position.planet]);
        }
        // Real direction from the ephemeris, projected into the orbit plane
        // (the ecliptic when there's no pole); the ring (built in XZ) is
        // turned to match.
        if (position.orbitPole) {
          toScene(position.orbitPole, scratchPole).normalize();
        } else {
          scratchPole.set(0, 1, 0);
        }
        toScene(position.offsetAu, scratch);
        scratch.addScaledVector(scratchPole, -scratch.dot(scratchPole));
        if (scratch.lengthSq() === 0) {
          scratch.set(1, 0, 0);
        }
        scratch.normalize();
        moon.mesh.position.copy(planet.mesh.position).addScaledVector(scratch, moon.orbitRadius);
        moon.ring.position.copy(planet.mesh.position);
        moon.ring.quaternion.setFromUnitVectors(RING_NORMAL, scratchPole);
      }
    },
    setOrientations(next) {
      orientations = next;
      orientAll();
    },
    focusBody(key) {
      const body = key === null ? null : (allBodies().find((candidate) => candidate.name === key) ?? null);
      if (key !== null && !body) {
        // Not here yet (a layer still loading) — focus it when it arrives.
        pendingFocus = key;
        return;
      }
      pendingFocus = null;
      flyTo(body);
    },
    setOnFocusChange(handler) {
      onFocusChange = handler;
    },
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('click', handleClick);
      detachKeyboardZoom();
      autoRotate.dispose();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
        }
      });
      for (const content of layers.values()) {
        clearTracks(content);
      }
      for (const body of allBodies()) {
        body.label?.dispose();
      }
      for (const material of markerMaterials.values()) {
        material.dispose();
      }
      for (const ring of orbitRings.values()) {
        ring.material.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      for (const texture of textures) {
        texture.dispose();
      }
      renderer.dispose();
      starfield.dispose();
    },
  };
}
