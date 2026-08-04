import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HeliocentricVector, PlanetPosition } from '../astro/planetPositions';
import type { MoonPosition } from '../astro/moonPositions';
import { heliocentricToSceneVector } from '../astro/coords';
import { createStarfield } from './starfield';
import { makeLabelSprite, scaleLabelToScreen, type LabelSprite } from './labelSprite';
import { attachKeyboardZoom } from './orbitControlsExtras';

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

function bodyRadiusUnits(name: string): number {
  const km = BODY_RADII_KM[name] ?? BODY_RADII_KM.Earth;
  return Math.max(MIN_PLANET_RADIUS, km * PLANET_RADIUS_UNITS_PER_KM);
}

// Moons sit far too close to their planet to see at true scale, so they're
// drawn on exaggerated display orbits (real longitude kept, inclination
// flattened into the ecliptic plane) that start just outside the planet body.
const MOON_ORBIT_GAP = 0.35;
const MOON_RADIUS_STEP = 0.4;
// Constant on-screen label sizes, in CSS pixels — unchanged by zoom or by
// expanding the card to full screen (see scaleLabelToScreen).
const PLANET_LABEL_PX = 13;
const MOON_LABEL_PX = 11;
// How far a planet's name sits above the planet, radially outward from the Sun.
const PLANET_LABEL_OFFSET = 0.9;

const PLANET_COLORS: Record<string, number> = {
  Mercury: 0x9c9c9c,
  Venus: 0xd9b38c,
  Earth: 0x3987e5,
  Mars: 0xd95926,
  Jupiter: 0xc98500,
  Saturn: 0xe0c48a,
  Uranus: 0x9de0e0,
  Neptune: 0x4166f5,
};

export interface OrbitPath {
  name: string;
  points: HeliocentricVector[];
}

export interface SolarSystemSceneHandle {
  setPlanetPositions(positions: PlanetPosition[]): void;
  setOrbitPaths(paths: OrbitPath[]): void;
  setMoons(moons: MoonPosition[]): void;
  resize(): void;
  dispose(): void;
}

function moonRingGeometry(radius: number): THREE.BufferGeometry {
  const segments = 48;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function planetColor(name: string): number {
  return PLANET_COLORS[name] ?? 0xffffff;
}

function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
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

export function createSolarSystemScene(canvas: HTMLCanvasElement): SolarSystemSceneHandle {
  const scene = new THREE.Scene();
  // far must clear the far side of the star sphere at max zoom-out
  // (camera up to 300 from origin + 400 sphere radius = 700), otherwise the
  // sphere's back hemisphere is clipped and shows as a grey disc.
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.set(0, 40, 60);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
  controls.minDistance = 10;
  controls.maxDistance = 300;
  const detachKeyboardZoom = attachKeyboardZoom(controls, camera, canvas);

  const starfield = createStarfield(400);
  scene.add(starfield.mesh);

  scene.add(new THREE.AmbientLight(0x556688, 1.8));

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_RADIUS_UNITS, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xfab219 }),
  );
  scene.add(sun);
  scene.add(new THREE.PointLight(0xffffff, 3, 0, 0));

  const planetMeshes = new Map<string, THREE.Mesh>();
  const planetRadii = new Map<string, number>();
  const planetLabels = new Map<string, LabelSprite>();
  const orbitRings = new Map<string, THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>>();

  const scratchLabel = new THREE.Vector3();
  // Sit the label a fixed gap beyond the planet's surface (radially outward from
  // the Sun) so it clears large bodies like Jupiter instead of landing on them.
  function planetLabelPosition(planet: THREE.Vector3, radius: number): THREE.Vector3 {
    scratchLabel.copy(planet);
    const length = scratchLabel.length() || 1;
    return scratchLabel.multiplyScalar((length + radius + PLANET_LABEL_OFFSET) / length);
  }

  // Moon meshes get a per-moon geometry sized to real diameter (below), so only
  // the material is shared here.
  const moonMaterial = new THREE.MeshStandardMaterial({ color: 0xcfd4e0, emissive: 0x222831 });
  const moonRingMaterial = new THREE.LineBasicMaterial({ color: 0x6f7fa6, transparent: true, opacity: 0.35 });
  const moonGroup = new THREE.Group();
  scene.add(moonGroup);
  let moonObjects: { mesh: THREE.Mesh; ring: THREE.LineLoop; label: LabelSprite }[] = [];

  function clearMoons() {
    for (const { mesh, ring, label } of moonObjects) {
      moonGroup.remove(mesh);
      moonGroup.remove(ring);
      moonGroup.remove(label.sprite);
      mesh.geometry.dispose();
      ring.geometry.dispose();
      label.dispose();
    }
    moonObjects = [];
  }

  const scratchDir = new THREE.Vector3();

  let frameId = 0;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
    for (const label of planetLabels.values()) {
      scaleLabelToScreen(label, camera, canvas.clientHeight, PLANET_LABEL_PX);
    }
    for (const { label } of moonObjects) {
      scaleLabelToScreen(label, camera, canvas.clientHeight, MOON_LABEL_PX);
    }
    renderer.render(scene, camera);
  }
  animate();

  return {
    setPlanetPositions(positions) {
      for (const planet of positions) {
        let mesh = planetMeshes.get(planet.name);
        if (!mesh) {
          const radius = bodyRadiusUnits(planet.name);
          planetRadii.set(planet.name, radius);
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 24, 24),
            new THREE.MeshStandardMaterial({ color: planetColor(planet.name) }),
          );
          scene.add(mesh);
          planetMeshes.set(planet.name, mesh);
        }
        const vector = heliocentricToSceneVector(planet.xAu, planet.yAu, planet.zAu, UNITS_PER_AU);
        mesh.position.set(vector.x, vector.y, vector.z);

        let label = planetLabels.get(planet.name);
        if (!label) {
          label = makeLabelSprite(planet.name, hexToCss(planetColor(planet.name)));
          scene.add(label.sprite);
          planetLabels.set(planet.name, label);
        }
        label.sprite.position.copy(planetLabelPosition(mesh.position, planetRadii.get(planet.name) ?? MIN_PLANET_RADIUS));
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
    setMoons(moons) {
      clearMoons();
      for (const moon of moons) {
        const planet = planetMeshes.get(moon.planet);
        if (!planet) {
          continue;
        }
        // Real longitude from the ephemeris, flattened into the ecliptic plane.
        const offset = heliocentricToSceneVector(moon.offsetAu.xAu, moon.offsetAu.yAu, moon.offsetAu.zAu, UNITS_PER_AU);
        scratchDir.set(offset.x, 0, offset.z);
        if (scratchDir.lengthSq() === 0) {
          scratchDir.set(1, 0, 0);
        }
        scratchDir.normalize();
        const planetRadius = planetRadii.get(moon.planet) ?? MIN_PLANET_RADIUS;
        const radius = planetRadius + MOON_ORBIT_GAP + moon.order * MOON_RADIUS_STEP;

        const mesh = new THREE.Mesh(new THREE.SphereGeometry(bodyRadiusUnits(moon.name), 16, 16), moonMaterial);
        mesh.position.copy(planet.position).addScaledVector(scratchDir, radius);
        moonGroup.add(mesh);

        const ring = new THREE.LineLoop(moonRingGeometry(radius), moonRingMaterial);
        ring.position.copy(planet.position);
        moonGroup.add(ring);

        const label = makeLabelSprite(moon.name, '#cfd4e0');
        label.sprite.position.copy(mesh.position);
        moonGroup.add(label.sprite);

        moonObjects.push({ mesh, ring, label });
      }
    },
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      detachKeyboardZoom();
      controls.dispose();
      clearMoons();
      for (const label of planetLabels.values()) {
        scene.remove(label.sprite);
        label.dispose();
      }
      planetLabels.clear();
      moonMaterial.dispose();
      moonRingMaterial.dispose();
      renderer.dispose();
      starfield.dispose();
    },
  };
}
