import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneVector3 } from '../astro/coords';
import earthTextureUrl from '../assets/earth-diffuse.jpg';

export const EARTH_RADIUS_UNITS = 2;

export interface EarthSceneHandle {
  setIssPosition(position: SceneVector3 | null): void;
  setOrbitPath(points: SceneVector3[]): void;
  setSatellites(positions: SceneVector3[]): void;
  resize(): void;
  dispose(): void;
}

export function createEarthScene(canvas: HTMLCanvasElement): EarthSceneHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(0, 2, 7);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  controls.minDistance = 3;
  controls.maxDistance = 20;

  // Low ambient + a single strong "sun" light gives a visible day/night
  // terminator instead of flat, uniformly lit shading.
  scene.add(new THREE.AmbientLight(0x223355, 0.55));
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.4);
  sunLight.position.set(5, 2, 4);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x334466, 0.18);
  fillLight.position.set(-5, -2, -4);
  scene.add(fillLight);

  const earthTexture = new THREE.TextureLoader().load(earthTextureUrl);
  earthTexture.colorSpace = THREE.SRGBColorSpace;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 48, 48),
    new THREE.MeshPhongMaterial({ map: earthTexture, shininess: 6 }),
  );
  scene.add(earth);

  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.001, 24, 16)),
    new THREE.LineBasicMaterial({ color: 0x2f5a99, transparent: true, opacity: 0.15 }),
  );
  scene.add(grid);

  const issMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfab219 }),
  );
  issMarker.visible = false;
  scene.add(issMarker);

  const satelliteGeometry = new THREE.SphereGeometry(0.035, 8, 8);
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const satelliteGroup = new THREE.Group();
  scene.add(satelliteGroup);

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
    setSatellites(positions) {
      while (satelliteGroup.children.length > positions.length) {
        const last = satelliteGroup.children[satelliteGroup.children.length - 1];
        satelliteGroup.remove(last);
      }
      positions.forEach((position, i) => {
        const existing = satelliteGroup.children[i];
        const marker = existing instanceof THREE.Mesh ? existing : new THREE.Mesh(satelliteGeometry, satelliteMaterial);
        if (!existing) {
          satelliteGroup.add(marker);
        }
        marker.position.set(position.x, position.y, position.z);
      });
    },
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      earthTexture.dispose();
    },
  };
}
