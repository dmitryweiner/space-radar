import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { HeliocentricVector, PlanetPosition } from '../astro/planetPositions';
import { heliocentricToSceneVector } from '../astro/coords';

const UNITS_PER_AU = 6;

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
  resize(): void;
  dispose(): void;
}

function planetColor(name: string): number {
  return PLANET_COLORS[name] ?? 0xffffff;
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
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
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

  scene.add(new THREE.AmbientLight(0x556688, 1.8));

  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfab219 }));
  scene.add(sun);
  scene.add(new THREE.PointLight(0xffffff, 3, 0, 0));

  const planetMeshes = new Map<string, THREE.Mesh>();
  const orbitRings = new Map<string, THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>>();

  let frameId = 0;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setPlanetPositions(positions) {
      for (const planet of positions) {
        let mesh = planetMeshes.get(planet.name);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshStandardMaterial({ color: planetColor(planet.name) }),
          );
          scene.add(mesh);
          planetMeshes.set(planet.name, mesh);
        }
        const vector = heliocentricToSceneVector(planet.xAu, planet.yAu, planet.zAu, UNITS_PER_AU);
        mesh.position.set(vector.x, vector.y, vector.z);
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
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    },
  };
}
