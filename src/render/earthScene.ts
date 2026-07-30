import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneVector3 } from '../astro/coords';

export const EARTH_RADIUS_UNITS = 2;

export interface EarthSceneHandle {
  setIssPosition(position: SceneVector3 | null): void;
  setOrbitPath(points: SceneVector3[]): void;
  resize(): void;
  dispose(): void;
}

export function createEarthScene(canvas: HTMLCanvasElement): EarthSceneHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 2, 7);

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
  controls.minDistance = 3;
  controls.maxDistance = 20;

  scene.add(new THREE.AmbientLight(0x6d84b8, 1.8));
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x5577aa, 0.6);
  fillLight.position.set(-5, -2, -4);
  scene.add(fillLight);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 48, 48),
    new THREE.MeshPhongMaterial({ color: 0x1b3a6b, emissive: 0x0a1530, shininess: 8 }),
  );
  scene.add(earth);

  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.001, 24, 16)),
    new THREE.LineBasicMaterial({ color: 0x2f5a99, transparent: true, opacity: 0.35 }),
  );
  scene.add(grid);

  const issMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfab219 }),
  );
  issMarker.visible = false;
  scene.add(issMarker);

  let orbitLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;

  let frameId = 0;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setIssPosition(position) {
      if (!position) {
        issMarker.visible = false;
        return;
      }
      issMarker.visible = true;
      issMarker.position.set(position.x, position.y, position.z);
    },
    setOrbitPath(points) {
      if (orbitLine) {
        scene.remove(orbitLine);
        orbitLine.geometry.dispose();
        orbitLine.material.dispose();
        orbitLine = null;
      }
      if (points.length < 2) {
        return;
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
      );
      const material = new THREE.LineBasicMaterial({ color: 0x5eb1ff });
      orbitLine = new THREE.Line(geometry, material);
      scene.add(orbitLine);
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
