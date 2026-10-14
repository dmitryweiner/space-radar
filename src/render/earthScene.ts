import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { geodeticToSceneVector, type SceneVector3 } from '../astro/coords';
import { subsolarPoint } from '../astro/subsolar';
import earthTextureUrl from '../assets/earth-diffuse.jpg';
import earthMapTextureUrl from '../assets/earth-map.jpg';
import { createStarfield } from './starfield';
import { makeLabelSprite, scaleLabelToScreen, type LabelSprite } from './labelSprite';
import { makeTrail, type TrailLine } from './trailLine';
import { attachCooperativeGestures, attachKeyboardZoom } from './orbitControlsExtras';

export const EARTH_RADIUS_UNITS = 2;

// How close the camera can dolly in — just above the surface so users can
// make out fine detail; far enough that geometry never clips the near plane.
const MIN_CAMERA_DISTANCE = EARTH_RADIUS_UNITS + 0.3;

// Slow idle spin, in OrbitControls units (2.0 ≈ one turn per 30 s at 60 fps),
// so a fresh globe drifts gently until the user grabs or zooms it.
const AUTO_ROTATE_SPEED = 0.4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// OrbitControls tracks its current gesture in a plain `state` property
// (`this.state = _STATE.ROTATE` etc. at runtime) that isn't part of its
// public type declarations — read it structurally instead of an `as` cast.
function currentControlsState(controls: OrbitControls): unknown {
  return isRecord(controls) ? controls.state : undefined;
}

// Labels and markers keep a constant on-screen *pixel* size — unchanged by zoom
// and by expanding a card to full screen (see scaleLabelToScreen). Marker sizes
// below are on-screen radii in CSS pixels.
const LABEL_PX = 13;
const ISS_MARKER_PX = 5;
const SATELLITE_MARKER_PX = 2.4;
const EVENT_MARKER_PX = 3.2;
const FIRE_POINT_PX = 2.5;
const AURORA_POINT_PX = 3.5;
const FIRE_LABEL_PX = 12;

// Base sphere radii the marker meshes are built with; scaleMarker rescales them
// each frame so their rendered radius matches the pixel targets above.
const ISS_MARKER_RADIUS = 0.1;
const SATELLITE_MARKER_RADIUS = 0.035;
const EVENT_MARKER_RADIUS = 0.06;

export interface NamedPosition {
  name: string;
  position: SceneVector3;
  /** Orbit trail ordered tail → head (head = current position). */
  trail: SceneVector3[];
}

export interface GlobeMarker {
  id: string;
  position: SceneVector3;
  color: number;
  label?: string;
}

export interface FirePoint {
  position: SceneVector3;
  /** 0..1, drives the yellow→red colour ramp. */
  intensity: number;
  /** When set, a permanent label is drawn beside the point (used for the
   * strongest fires only — labelling every point would be unreadable). */
  label?: string;
}

/** A static polyline (flyby path, Moon orbit…), in scene units. */
export interface GlobeTrack {
  id: string;
  points: SceneVector3[];
  color: number;
  /** 0..1, default 0.55. */
  opacity?: number;
}

export interface AuroraPoint {
  position: SceneVector3;
  /** 0..1 probability; brightens the additive green glow. */
  probability: number;
}

// What got clicked — `fire`/`aurora` carry an index into the array most
// recently passed to setFirePoints/setAuroraPoints (both render as a single
// THREE.Points cloud, so a raycast hit only yields a buffer index, not an id).
export type MarkerHit =
  | { kind: 'iss' }
  | { kind: 'satellite'; name: string }
  | { kind: 'marker'; id: string }
  | { kind: 'fire'; index: number }
  | { kind: 'aurora'; index: number };

/** One independently toggleable set of markers/points on the globe. */
export interface EarthLayerHandle {
  setIssPosition(position: SceneVector3 | null, trail?: SceneVector3[]): void;
  setSatellites(satellites: NamedPosition[]): void;
  setMarkers(markers: GlobeMarker[]): void;
  setFirePoints(points: FirePoint[]): void;
  setAuroraPoints(points: AuroraPoint[]): void;
  /** Replaces the layer's polylines. Passing the same array again is a no-op,
   * so a layer can re-send an unchanged (memoized) track list every tick. */
  setTracks(tracks: GlobeTrack[]): void;
  /** City-lights image (equirectangular) glowing on the night side only;
   * null removes it. One overlay per globe, owned by whichever layer set it. */
  setNightLights(url: string | null): void;
  setVisible(visible: boolean): void;
}

/** Where the Sun is overhead (see src/astro/subsolar.ts). */
export interface SunPosition {
  latitudeDeg: number;
  longitudeDeg: number;
}

/**
 * The flat EarthLayerHandle methods act on a built-in "default" layer — what
 * a single-source dashboard card uses. The Scene view instead draws several
 * sources on one globe via `layer(id)`, one group per source, so each can be
 * toggled and cleared without touching the others.
 */
export interface EarthSceneHandle extends EarthLayerHandle {
  layer(id: string): EarthLayerHandle;
  removeLayer(id: string): void;
  /** Multiplies every label/marker's on-screen pixel size (see the global
   * "Globe label size" setting). 1 = the base sizes below. */
  setLabelScale(scale: number): void;
  /** 'globe' (default): photo texture lit by a directional "sun" light, so
   * there's a day/night terminator. 'map': flat, evenly-lit political map —
   * no shadow hiding markers on the dark side. 'satellite': a recent NASA
   * GIBS true-colour mosaic (see setSatelliteTexture), lit like 'globe'. Any
   * other string falls back to 'globe'. */
  setEarthStyle(style: string): void;
  /** Image URL for the 'satellite' Earth style; null = not loaded (falls back
   * to the photo texture until it arrives). */
  setSatelliteTexture(url: string | null): void;
  /** Points the "sun" light from the real sub-solar point, so the terminator
   * is where it actually is right now (or at the scrubbed time). */
  setSunPosition(sun: SunPosition): void;
  /** Multiplies the idle auto-rotate speed (see the global "Auto-rotate
   * speed" setting). 1 = AUTO_ROTATE_SPEED below; 0 stops the spin. */
  setAutoRotateSpeed(multiplier: number): void;
  /** Dolly the camera to `distance` from the centre (clamped to the zoom
   * limits) — e.g. to take in the asteroid-flyby scale. Ends aspect fitting. */
  setViewDistance(distance: number): void;
  /** Fires when the user clicks a marker/satellite/ISS/fire/aurora point,
   * with the id of the layer it belongs to. Pass null to detach. */
  setOnMarkerClick(handler: ((hit: MarkerHit, layerId: string) => void) | null): void;
  resize(): void;
  dispose(): void;
}

export const DEFAULT_LAYER_ID = 'default';

const LABEL_RADIAL_OFFSET = 0.22;

function labelPosition(position: SceneVector3, target: THREE.Vector3): THREE.Vector3 {
  target.set(position.x, position.y, position.z);
  const length = target.length() || 1;
  return target.multiplyScalar((length + LABEL_RADIAL_OFFSET) / length);
}

export function createEarthScene(canvas: HTMLCanvasElement): EarthSceneHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 2, 7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // The FOV is vertical, so on a tall, narrow canvas (a phone in portrait) a
  // globe framed for a landscape card overflows the sides. Until the user
  // zooms, keep the distance fitted to the aspect ratio; once the distance no
  // longer matches the last fit (wheel, pinch, +/- keys), leave it alone.
  const BASE_DISTANCE = camera.position.length();
  let fittedDistance: number | null = BASE_DISTANCE;
  function fitDistance() {
    if (fittedDistance === null) {
      return;
    }
    const current = camera.position.length();
    if (Math.abs(current - fittedDistance) > fittedDistance * 0.01) {
      fittedDistance = null;
      return;
    }
    fittedDistance = BASE_DISTANCE / Math.min(1, camera.aspect * 1.25);
    camera.position.setLength(fittedDistance);
  }

  function applySize() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    fitDistance();
  }
  applySize();
  const resizeObserver = new ResizeObserver(() => applySize());
  resizeObserver.observe(canvas);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = MIN_CAMERA_DISTANCE;
  // Far enough to take in the asteroid-flyby layer's compressed distance
  // scale (out to ~14 units) — see src/astro/flyby.ts.
  controls.maxDistance = 32;

  // Gently auto-rotate until the user actually moves the globe (drag-rotate
  // or drag-pan); zooming (wheel, trackpad pinch, keyboard +/-, or a
  // middle-drag dolly) leaves it spinning. OrbitControls fires 'start' on any
  // pointer interaction, but only *sets* its internal `state` for gestures
  // that need to track motion across multiple events — a mouse-wheel/pinch
  // zoom is a one-shot action handled inline in the wheel handler, which
  // never touches `state`, so it fires 'start' with `state` left at NONE
  // (-1); a middle-mouse-button-drag dolly *is* a multi-event drag, so it
  // does get its own state, DOLLY (1). Both are zoom-only and must be
  // excluded, or trackpad pinch-zoom (delivered as wheel events) stops the
  // spin exactly like a real drag would. Two-finger touch gestures always mix
  // a pinch with pan/rotate, so those still count as a move. `state`'s enum
  // isn't exported by the OrbitControls module, so the values are hardcoded
  // here with this comment as the source of truth.
  const ORBIT_CONTROLS_NONE_STATE = -1;
  const ORBIT_CONTROLS_DOLLY_STATE = 1;
  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  const stopAutoRotateOnMove = () => {
    const state = currentControlsState(controls);
    if (state !== ORBIT_CONTROLS_NONE_STATE && state !== ORBIT_CONTROLS_DOLLY_STATE) {
      controls.autoRotate = false;
    }
  };
  controls.addEventListener('start', stopAutoRotateOnMove);
  const detachKeyboardZoom = attachKeyboardZoom(controls, camera, canvas);
  const detachCooperativeGestures = attachCooperativeGestures(controls, canvas);

  const starfield = createStarfield(100);
  scene.add(starfield.mesh);

  // Low ambient + a single strong "sun" light gives a visible day/night
  // terminator instead of flat, uniformly lit shading. The light sits over the
  // real sub-solar point (setSunPosition); the fill light faces it.
  // Enough ambient that continents stay faintly readable on the night side.
  scene.add(new THREE.AmbientLight(0x2a3a60, 0.8));
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x334466, 0.18);
  scene.add(fillLight);
  const SUN_LIGHT_DISTANCE = 10;
  function placeSun({ latitudeDeg, longitudeDeg }: SunPosition) {
    const v = geodeticToSceneVector(latitudeDeg, longitudeDeg, 0, SUN_LIGHT_DISTANCE);
    sunLight.position.set(v.x, v.y, v.z);
    fillLight.position.set(-v.x, -v.y, -v.z);
    sunDirection.set(v.x, v.y, v.z).normalize();
  }
  const sunDirection = new THREE.Vector3(1, 0, 0);
  const initialSun = subsolarPoint(new Date());
  placeSun(initialSun);
  // Open over the sunlit hemisphere: with a real terminator a fixed starting
  // view would show a black night side for half of every day.
  const initialView = geodeticToSceneVector(20, initialSun.longitudeDeg, 0, camera.position.length());
  camera.position.set(initialView.x, initialView.y, initialView.z);
  controls.update();

  const textureLoader = new THREE.TextureLoader();
  const earthPhotoTexture = textureLoader.load(earthTextureUrl);
  earthPhotoTexture.colorSpace = THREE.SRGBColorSpace;
  const earthMapTexture = textureLoader.load(earthMapTextureUrl);
  earthMapTexture.colorSpace = THREE.SRGBColorSpace;

  const globeMaterial = new THREE.MeshPhongMaterial({ map: earthPhotoTexture, shininess: 6 });
  // Unlit: ignores the directional "sun" light entirely, so the flat map has
  // no day/night terminator hiding markers on what would be the dark side.
  const mapMaterial = new THREE.MeshBasicMaterial({ map: earthMapTexture });
  // 'satellite' style: a recent GIBS mosaic, lit like the photo globe. Starts
  // on the photo texture and swaps once the (large) image has loaded.
  const satelliteImageMaterial = new THREE.MeshPhongMaterial({ map: earthPhotoTexture, shininess: 4 });
  let satelliteTexture: THREE.Texture | null = null;
  let satelliteTextureUrl: string | null = null;

  const earth: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial | THREE.MeshBasicMaterial> = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64),
    globeMaterial,
  );
  scene.add(earth);

  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.001, 24, 16)),
    new THREE.LineBasicMaterial({ color: 0x2f5a99, transparent: true, opacity: 0.15 }),
  );
  scene.add(grid);

  // Night-lights overlay: a sphere just above the surface, additive, whose
  // brightness is masked to the night side by the sun direction (the globe
  // never rotates — the camera orbits — so object normals are world normals).
  // Only bright pixels pass, so Black Marble's faint bluish land doesn't wash
  // over the photo texture.
  const nightUniforms = {
    lights: { value: new THREE.Texture() },
    sunDirection: { value: sunDirection },
    strength: { value: 1.6 },
  };
  const nightLights = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.002, 64, 64),
    new THREE.ShaderMaterial({
      uniforms: nightUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D lights;
        uniform vec3 sunDirection;
        uniform float strength;
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          float night = smoothstep(0.08, -0.12, dot(vNormal, sunDirection));
          vec3 c = texture2D(lights, vUv).rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          float glow = clamp((lum - 0.22) * 2.5, 0.0, 1.0);
          gl_FragColor = vec4(c * glow * night * strength, 1.0);
        }`,
    }),
  );
  nightLights.visible = false;
  scene.add(nightLights);
  let nightLightsTexture: THREE.Texture | null = null;
  let nightLightsUrl: string | null = null;
  let nightLightsOwner: object | null = null;

  function setNightLightsFor(owner: object, url: string | null) {
    if (!url) {
      if (nightLightsOwner === owner) {
        nightLightsOwner = null;
        nightLights.visible = false;
      }
      return;
    }
    nightLightsOwner = owner;
    if (url !== nightLightsUrl) {
      nightLightsUrl = url;
      textureLoader.load(url, (texture) => {
        if (nightLightsUrl !== url) {
          texture.dispose();
          return;
        }
        nightLightsTexture?.dispose();
        nightLightsTexture = texture;
        nightUniforms.lights.value = texture;
        nightLights.visible = nightLightsOwner !== null;
      });
    } else if (nightLightsTexture) {
      nightLights.visible = true;
    }
  }

  // Shared by every layer's markers.
  const SATELLITE_COLOR = 0x9fd8ff;
  const issGeometry = new THREE.SphereGeometry(ISS_MARKER_RADIUS, 16, 16);
  const issMaterial = new THREE.MeshBasicMaterial({ color: 0xfab219 });
  const satelliteGeometry = new THREE.SphereGeometry(SATELLITE_MARKER_RADIUS, 8, 8);
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color: SATELLITE_COLOR });
  const markerGeometry = new THREE.SphereGeometry(EVENT_MARKER_RADIUS, 12, 12);

  const scratch = new THREE.Vector3();
  const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

  // User-controlled multiplier (the global "Globe label size" setting) on top
  // of the base pixel sizes below — applied here so every label/marker picks
  // it up every frame without threading it through each call site.
  let labelScale = 1;

  function rescaleLabel(label: LabelSprite, pixelHeight = LABEL_PX) {
    scaleLabelToScreen(label, camera, canvas.clientHeight, pixelHeight * labelScale);
  }

  // Rescale a marker mesh so its rendered radius is `pxRadius` CSS pixels
  // regardless of camera distance — markers stay a constant on-screen size when
  // zooming, matching the labels.
  function scaleMarker(mesh: THREE.Object3D, pxRadius: number, baseRadius: number) {
    const distance = camera.position.distanceTo(mesh.position);
    const worldRadius = (pxRadius * labelScale * 2 * FOV_TAN * distance) / Math.max(1, canvas.clientHeight);
    const s = worldRadius / baseRadius;
    mesh.scale.set(s, s, s);
  }

  // sizeAttenuation:false Points take a size in framebuffer pixels, so scale
  // by the pixel ratio to land on the intended CSS-pixel size.
  function pointSize(px: number): number {
    return px * labelScale * renderer.getPixelRatio();
  }

  type HitCollector = (object: THREE.Object3D, hit: MarkerHit) => void;

  interface LayerContent {
    handle: EarthLayerHandle;
    group: THREE.Group;
    collectTargets(add: HitCollector): void;
    /** Buffer-index hits on this layer's Points clouds (fires, aurora). */
    pickPoints(isVisible: (distance: number) => boolean): MarkerHit | null;
    rescale(): void;
    applyLabelScale(): void;
    dispose(): void;
  }

  function createLayerContent(): LayerContent {
    const group = new THREE.Group();
    scene.add(group);

    const issMarker = new THREE.Mesh(issGeometry, issMaterial);
    issMarker.visible = false;
    group.add(issMarker);
    const issLabel = makeLabelSprite('ISS', '#fab219');
    issLabel.sprite.visible = false;
    group.add(issLabel.sprite);
    const issTrail = makeTrail(0xfab219);
    group.add(issTrail.line);

    const satelliteMarkers = new Map<string, { mesh: THREE.Mesh; label: LabelSprite; trail: TrailLine }>();
    const eventMarkers = new Map<string, { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }>();

    let firePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
    // Permanent labels beside the strongest fire points (depth-tested sprites,
    // so the opaque Earth hides the ones on the far side for free). Each
    // carries the originating index into the array most recently passed to
    // setFirePoints, so a click on the label resolves to the same point a
    // click on the dot would.
    let fireLabels: { index: number; label: LabelSprite }[] = [];
    let auroraPoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
    let tracks: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
    let lastTracks: GlobeTrack[] | null = null;
    let ownNightLights: string | null = null;

    function clearTracks() {
      for (const line of tracks) {
        group.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      }
      tracks = [];
    }

    function disposeSatellite(entry: { mesh: THREE.Mesh; label: LabelSprite; trail: TrailLine }) {
      group.remove(entry.mesh, entry.label.sprite, entry.trail.line);
      entry.label.dispose();
      entry.trail.dispose();
    }

    function disposeEventMarker(entry: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }) {
      group.remove(entry.mesh, entry.label.sprite);
      entry.material.dispose();
      entry.label.dispose();
    }

    function clearFirePoints() {
      if (firePoints) {
        group.remove(firePoints);
        firePoints.geometry.dispose();
        firePoints.material.dispose();
        firePoints = null;
      }
      for (const { label } of fireLabels) {
        group.remove(label.sprite);
        label.dispose();
      }
      fireLabels = [];
    }

    function clearAuroraPoints() {
      if (auroraPoints) {
        group.remove(auroraPoints);
        auroraPoints.geometry.dispose();
        auroraPoints.material.dispose();
        auroraPoints = null;
      }
    }

    function pointsCloud(
      count: number,
      fill: (i: number, positions: Float32Array, colors: Float32Array) => void,
      material: THREE.PointsMaterial,
    ): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        fill(i, positions, colors);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return new THREE.Points(geometry, material);
    }

    const handle: EarthLayerHandle = {
      setIssPosition(position, trail = []) {
        if (!position) {
          issMarker.visible = false;
          issLabel.sprite.visible = false;
          issTrail.setPoints([]);
          return;
        }
        issMarker.visible = true;
        issMarker.position.set(position.x, position.y, position.z);
        issLabel.sprite.visible = true;
        issLabel.sprite.position.copy(labelPosition(position, scratch));
        issTrail.setPoints(trail);
      },
      setSatellites(satellites) {
        const incoming = new Set(satellites.map((sat) => sat.name));
        for (const [name, entry] of satelliteMarkers) {
          if (!incoming.has(name)) {
            disposeSatellite(entry);
            satelliteMarkers.delete(name);
          }
        }
        for (const { name, position, trail } of satellites) {
          let entry = satelliteMarkers.get(name);
          if (!entry) {
            const mesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
            const label = makeLabelSprite(name, '#9fd8ff');
            const trailLine = makeTrail(SATELLITE_COLOR);
            group.add(mesh, label.sprite, trailLine.line);
            entry = { mesh, label, trail: trailLine };
            satelliteMarkers.set(name, entry);
          }
          entry.mesh.position.set(position.x, position.y, position.z);
          entry.label.sprite.position.copy(labelPosition(position, scratch));
          entry.trail.setPoints(trail);
        }
      },
      setMarkers(markers) {
        const incoming = new Set(markers.map((marker) => marker.id));
        for (const [id, entry] of eventMarkers) {
          if (!incoming.has(id)) {
            disposeEventMarker(entry);
            eventMarkers.delete(id);
          }
        }
        for (const marker of markers) {
          let entry = eventMarkers.get(marker.id);
          if (!entry) {
            const material = new THREE.MeshBasicMaterial({ color: marker.color });
            const mesh = new THREE.Mesh(markerGeometry, material);
            const label = makeLabelSprite(marker.label ?? '', '#e6ecff');
            label.sprite.visible = Boolean(marker.label);
            group.add(mesh, label.sprite);
            entry = { mesh, material, label };
            eventMarkers.set(marker.id, entry);
          } else {
            entry.material.color.set(marker.color);
          }
          entry.mesh.position.set(marker.position.x, marker.position.y, marker.position.z);
          entry.label.sprite.position.copy(labelPosition(marker.position, scratch));
        }
      },
      setFirePoints(points) {
        clearFirePoints();
        if (points.length === 0) {
          return;
        }
        firePoints = pointsCloud(
          points.length,
          (i, positions, colors) => {
            const point = points[i];
            positions[i * 3] = point.position.x;
            positions[i * 3 + 1] = point.position.y;
            positions[i * 3 + 2] = point.position.z;
            const t = Math.min(1, Math.max(0, point.intensity));
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 0.85 - 0.75 * t;
            colors[i * 3 + 2] = 0.2 - 0.18 * t;
            // Points flagged with a label get a permanent sprite beside them.
            if (point.label) {
              const label = makeLabelSprite(point.label, '#ffd7a0');
              label.sprite.position.copy(labelPosition(point.position, scratch));
              group.add(label.sprite);
              fireLabels.push({ index: i, label });
            }
          },
          // sizeAttenuation:false keeps every fire point a constant on-screen
          // size when zooming.
          new THREE.PointsMaterial({
            size: pointSize(FIRE_POINT_PX),
            vertexColors: true,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.9,
          }),
        );
        group.add(firePoints);
      },
      setAuroraPoints(points) {
        clearAuroraPoints();
        if (points.length === 0) {
          return;
        }
        auroraPoints = pointsCloud(
          points.length,
          (i, positions, colors) => {
            const point = points[i];
            positions[i * 3] = point.position.x;
            positions[i * 3 + 1] = point.position.y;
            positions[i * 3 + 2] = point.position.z;
            // Additive green glow: brighter where the probability is higher,
            // so faint edges of the oval fade out instead of a hard mask.
            const p = Math.min(1, Math.max(0, point.probability));
            colors[i * 3] = 0.2 * p;
            colors[i * 3 + 1] = 1.0 * p;
            colors[i * 3 + 2] = 0.5 * p;
          },
          new THREE.PointsMaterial({
            size: pointSize(AURORA_POINT_PX),
            vertexColors: true,
            sizeAttenuation: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        group.add(auroraPoints);
      },
      setTracks(next) {
        if (next === lastTracks) {
          return;
        }
        lastTracks = next;
        clearTracks();
        for (const track of next) {
          if (track.points.length < 2) {
            continue;
          }
          const geometry = new THREE.BufferGeometry().setFromPoints(
            track.points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
          );
          const material = new THREE.LineBasicMaterial({
            color: track.color,
            transparent: true,
            opacity: track.opacity ?? 0.55,
          });
          const line = new THREE.Line(geometry, material);
          tracks.push(line);
          group.add(line);
        }
      },
      setNightLights(url) {
        ownNightLights = url;
        setNightLightsFor(group, group.visible ? url : null);
      },
      setVisible(visible) {
        group.visible = visible;
        if (ownNightLights) {
          setNightLightsFor(group, visible ? ownNightLights : null);
        }
      },
    };

    return {
      handle,
      group,
      collectTargets(add) {
        if (issMarker.visible) {
          add(issMarker, { kind: 'iss' });
          add(issLabel.sprite, { kind: 'iss' });
        }
        for (const [name, entry] of satelliteMarkers) {
          add(entry.mesh, { kind: 'satellite', name });
          add(entry.label.sprite, { kind: 'satellite', name });
        }
        for (const [id, entry] of eventMarkers) {
          add(entry.mesh, { kind: 'marker', id });
          add(entry.label.sprite, { kind: 'marker', id });
        }
        for (const { index, label } of fireLabels) {
          add(label.sprite, { kind: 'fire', index });
        }
      },
      pickPoints(isVisible) {
        if (firePoints) {
          const hit = raycaster.intersectObject(firePoints).find((h) => isVisible(h.distance));
          if (hit && hit.index !== undefined) {
            return { kind: 'fire', index: hit.index };
          }
        }
        if (auroraPoints) {
          const hit = raycaster.intersectObject(auroraPoints).find((h) => isVisible(h.distance));
          if (hit && hit.index !== undefined) {
            return { kind: 'aurora', index: hit.index };
          }
        }
        return null;
      },
      rescale() {
        rescaleLabel(issLabel);
        if (issMarker.visible) {
          scaleMarker(issMarker, ISS_MARKER_PX, ISS_MARKER_RADIUS);
        }
        for (const entry of satelliteMarkers.values()) {
          rescaleLabel(entry.label);
          scaleMarker(entry.mesh, SATELLITE_MARKER_PX, SATELLITE_MARKER_RADIUS);
        }
        for (const entry of eventMarkers.values()) {
          rescaleLabel(entry.label);
          scaleMarker(entry.mesh, EVENT_MARKER_PX, EVENT_MARKER_RADIUS);
        }
        for (const { label } of fireLabels) {
          rescaleLabel(label, FIRE_LABEL_PX);
        }
      },
      applyLabelScale() {
        // Labels/markers are rescaled every frame, but the Points materials
        // bake their size in at creation — patch any existing cloud.
        if (firePoints) {
          firePoints.material.size = pointSize(FIRE_POINT_PX);
        }
        if (auroraPoints) {
          auroraPoints.material.size = pointSize(AURORA_POINT_PX);
        }
      },
      dispose() {
        clearFirePoints();
        clearAuroraPoints();
        clearTracks();
        setNightLightsFor(group, null);
        for (const entry of satelliteMarkers.values()) {
          disposeSatellite(entry);
        }
        satelliteMarkers.clear();
        for (const entry of eventMarkers.values()) {
          disposeEventMarker(entry);
        }
        eventMarkers.clear();
        issLabel.dispose();
        issTrail.dispose();
        scene.remove(group);
      },
    };
  }

  const layers = new Map<string, LayerContent>();
  function layerContent(id: string): LayerContent {
    let content = layers.get(id);
    if (!content) {
      content = createLayerContent();
      layers.set(id, content);
    }
    return content;
  }
  const defaultLayer = layerContent(DEFAULT_LAYER_ID).handle;

  // Click-to-inspect: one raycaster shared by every marker representation
  // this scene can hold (individual meshes for ISS/satellites/event markers,
  // buffer-index hits for the fire/aurora Points clouds), across all layers.
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.06 };
  const pointerNdc = new THREE.Vector2();
  let onMarkerClick: ((hit: MarkerHit, layerId: string) => void) | null = null;

  // Labels get far-side occlusion for free from the GPU depth test; the
  // raycaster has no such test, so a click could otherwise "hit" a marker
  // mathematically on the ray but actually hidden behind the opaque globe.
  // Compare every candidate hit against the Earth mesh's own hit distance
  // along the same ray and reject anything farther. The epsilon covers a
  // marker mesh's own radius (it sits slightly outside the exact sphere
  // surface) without being anywhere near the ~2×EARTH_RADIUS gap to a
  // genuinely far-side hit.
  const OCCLUSION_EPSILON = 0.05;

  function handleCanvasClick(event: MouseEvent) {
    if (!onMarkerClick) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const earthHits = raycaster.intersectObject(earth, false);
    const earthDistance = earthHits.length > 0 ? earthHits[0].distance : Infinity;
    const isVisible = (distance: number) => distance <= earthDistance + OCCLUSION_EPSILON;

    // Every clickable dot/marker AND its label sprite resolve to the same
    // MarkerHit, so clicking either one opens the same popup — a label's
    // rendered text is a much bigger, easier target than a few-pixel dot.
    const hitByObject = new Map<THREE.Object3D, { hit: MarkerHit; layerId: string }>();
    const targets: THREE.Object3D[] = [];
    for (const [layerId, content] of layers) {
      if (!content.group.visible) {
        continue;
      }
      content.collectTargets((object, hit) => {
        targets.push(object);
        hitByObject.set(object, { hit, layerId });
      });
    }

    const objectHits = targets.length > 0 ? raycaster.intersectObjects(targets, false) : [];
    const visibleObjectHit = objectHits.find((hit) => isVisible(hit.distance));
    if (visibleObjectHit) {
      const found = hitByObject.get(visibleObjectHit.object);
      if (found) {
        onMarkerClick(found.hit, found.layerId);
      }
      return;
    }

    for (const [layerId, content] of layers) {
      if (!content.group.visible) {
        continue;
      }
      const hit = content.pickPoints(isVisible);
      if (hit) {
        onMarkerClick(hit, layerId);
        return;
      }
    }
  }
  canvas.addEventListener('click', handleCanvasClick);

  let frameId = 0;
  // Real elapsed time between frames, in seconds, fed to controls.update()
  // below. Without it, OrbitControls' autoRotate falls back to a fixed
  // angle-per-*call* (assuming a steady 60 calls/sec) rather than a fixed
  // angle-per-*second* — so any real fluctuation in actual rAF delivery rate
  // (macOS ProMotion's adaptive refresh backing off during a slow, low-motion
  // idle spin and then ramping back up, background-tab GPU scheduling, a
  // compositor hiccup) visibly changes the rotation's on-screen speed:
  // slower during a lower-rate stretch, then abruptly faster once the rate
  // recovers — exactly the "stutters, then jerks forward" symptom. Capped at
  // 100ms so a long stall (e.g. the tab was backgrounded) doesn't make the
  // globe jump forward to "catch up" once it's visible again.
  const MAX_DELTA_SECONDS = 0.1;
  let lastFrameTime = performance.now();
  function animate() {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const deltaSeconds = Math.min((now - lastFrameTime) / 1000, MAX_DELTA_SECONDS);
    lastFrameTime = now;
    controls.update(deltaSeconds);
    for (const content of layers.values()) {
      if (content.group.visible) {
        content.rescale();
      }
    }
    renderer.render(scene, camera);
  }
  animate();

  let earthStyle = 'globe';
  function applyEarthStyle() {
    if (earthStyle === 'map') {
      earth.material = mapMaterial;
    } else if (earthStyle === 'satellite') {
      earth.material = satelliteImageMaterial;
    } else {
      earth.material = globeMaterial;
    }
  }

  return {
    setIssPosition: (position, trail) => defaultLayer.setIssPosition(position, trail),
    setSatellites: (satellites) => defaultLayer.setSatellites(satellites),
    setMarkers: (markers) => defaultLayer.setMarkers(markers),
    setFirePoints: (points) => defaultLayer.setFirePoints(points),
    setAuroraPoints: (points) => defaultLayer.setAuroraPoints(points),
    setTracks: (next) => defaultLayer.setTracks(next),
    setNightLights: (url) => defaultLayer.setNightLights(url),
    setVisible: (visible) => defaultLayer.setVisible(visible),
    layer(id) {
      return layerContent(id).handle;
    },
    removeLayer(id) {
      const content = layers.get(id);
      if (content && id !== DEFAULT_LAYER_ID) {
        content.dispose();
        layers.delete(id);
      }
    },
    setLabelScale(scale) {
      labelScale = scale;
      for (const content of layers.values()) {
        content.applyLabelScale();
      }
    },
    setEarthStyle(style) {
      earthStyle = style;
      applyEarthStyle();
    },
    setSatelliteTexture(url) {
      if (url === satelliteTextureUrl) {
        return;
      }
      satelliteTextureUrl = url;
      if (!url) {
        satelliteImageMaterial.map = earthPhotoTexture;
        satelliteImageMaterial.needsUpdate = true;
        return;
      }
      textureLoader.load(
        url,
        (texture) => {
          // A newer URL (or dispose) may have superseded this load.
          if (satelliteTextureUrl !== url) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          satelliteTexture?.dispose();
          satelliteTexture = texture;
          satelliteImageMaterial.map = texture;
          satelliteImageMaterial.needsUpdate = true;
        },
        undefined,
        () => {
          // Load failed — stay on the photo texture.
        },
      );
    },
    setSunPosition(sun) {
      placeSun(sun);
    },
    setAutoRotateSpeed(multiplier) {
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED * multiplier;
    },
    setViewDistance(distance) {
      fittedDistance = null;
      camera.position.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, distance)));
      controls.update();
    },
    setOnMarkerClick(handler) {
      onMarkerClick = handler;
    },
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('click', handleCanvasClick);
      controls.removeEventListener('start', stopAutoRotateOnMove);
      detachKeyboardZoom();
      detachCooperativeGestures();
      controls.dispose();
      for (const content of layers.values()) {
        content.dispose();
      }
      layers.clear();
      issGeometry.dispose();
      issMaterial.dispose();
      satelliteGeometry.dispose();
      satelliteMaterial.dispose();
      markerGeometry.dispose();
      renderer.dispose();
      globeMaterial.dispose();
      mapMaterial.dispose();
      satelliteImageMaterial.dispose();
      satelliteTextureUrl = null;
      satelliteTexture?.dispose();
      earthPhotoTexture.dispose();
      earthMapTexture.dispose();
      nightLightsUrl = null;
      nightLightsTexture?.dispose();
      nightLights.geometry.dispose();
      nightLights.material.dispose();
      starfield.dispose();
    },
  };
}
