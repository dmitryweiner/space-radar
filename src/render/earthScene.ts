import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneVector3 } from '../astro/coords';
import earthTextureUrl from '../assets/earth-diffuse.jpg';
import { createStarfield } from './starfield';
import { makeLabelSprite, type LabelSprite } from './labelSprite';

export const EARTH_RADIUS_UNITS = 2;

export interface NamedPosition {
  name: string;
  position: SceneVector3;
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
}

export interface EarthSceneHandle {
  setIssPosition(position: SceneVector3 | null): void;
  setOrbitPath(points: SceneVector3[]): void;
  setSatellites(satellites: NamedPosition[]): void;
  setMarkers(markers: GlobeMarker[]): void;
  setFirePoints(points: FirePoint[]): void;
  resize(): void;
  dispose(): void;
}

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

  const starfield = createStarfield(100);
  scene.add(starfield.mesh);

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
  const issLabel = makeLabelSprite('ISS', '#fab219');
  issLabel.sprite.visible = false;
  scene.add(issLabel.sprite);

  const satelliteGeometry = new THREE.SphereGeometry(0.035, 8, 8);
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
  const satelliteGroup = new THREE.Group();
  scene.add(satelliteGroup);
  const satelliteMarkers = new Map<string, { mesh: THREE.Mesh; label: LabelSprite }>();

  const markerGeometry = new THREE.SphereGeometry(0.06, 12, 12);
  const markerGroup = new THREE.Group();
  scene.add(markerGroup);
  const eventMarkers = new Map<string, { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }>();

  let firePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  let orbitLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;

  const scratch = new THREE.Vector3();

  function disposeSatellite(entry: { mesh: THREE.Mesh; label: LabelSprite }) {
    satelliteGroup.remove(entry.mesh);
    scene.remove(entry.label.sprite);
    entry.label.dispose();
  }

  function disposeEventMarker(entry: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }) {
    markerGroup.remove(entry.mesh);
    scene.remove(entry.label.sprite);
    entry.material.dispose();
    entry.label.dispose();
  }

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
        issLabel.sprite.visible = false;
        return;
      }
      issMarker.visible = true;
      issMarker.position.set(position.x, position.y, position.z);
      issLabel.sprite.visible = true;
      issLabel.sprite.position.copy(labelPosition(position, scratch));
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
    setSatellites(satellites) {
      const incoming = new Set(satellites.map((sat) => sat.name));
      for (const [name, entry] of satelliteMarkers) {
        if (!incoming.has(name)) {
          disposeSatellite(entry);
          satelliteMarkers.delete(name);
        }
      }
      for (const { name, position } of satellites) {
        let entry = satelliteMarkers.get(name);
        if (!entry) {
          const mesh = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
          satelliteGroup.add(mesh);
          const label = makeLabelSprite(name, '#9fd8ff');
          scene.add(label.sprite);
          entry = { mesh, label };
          satelliteMarkers.set(name, entry);
        }
        entry.mesh.position.set(position.x, position.y, position.z);
        entry.label.sprite.position.copy(labelPosition(position, scratch));
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
          markerGroup.add(mesh);
          const label = makeLabelSprite(marker.label ?? '', '#e6ecff');
          label.sprite.visible = Boolean(marker.label);
          scene.add(label.sprite);
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
      if (firePoints) {
        scene.remove(firePoints);
        firePoints.geometry.dispose();
        firePoints.material.dispose();
        firePoints = null;
      }
      if (points.length === 0) {
        return;
      }
      const positions = new Float32Array(points.length * 3);
      const colors = new Float32Array(points.length * 3);
      points.forEach((point, i) => {
        positions[i * 3] = point.position.x;
        positions[i * 3 + 1] = point.position.y;
        positions[i * 3 + 2] = point.position.z;
        const t = Math.min(1, Math.max(0, point.intensity));
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.85 - 0.75 * t;
        colors[i * 3 + 2] = 0.2 - 0.18 * t;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      });
      firePoints = new THREE.Points(geometry, material);
      scene.add(firePoints);
    },
    resize() {
      applySize();
    },
    dispose() {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      for (const entry of satelliteMarkers.values()) {
        disposeSatellite(entry);
      }
      satelliteMarkers.clear();
      for (const entry of eventMarkers.values()) {
        disposeEventMarker(entry);
      }
      eventMarkers.clear();
      if (firePoints) {
        firePoints.geometry.dispose();
        firePoints.material.dispose();
      }
      satelliteGeometry.dispose();
      satelliteMaterial.dispose();
      markerGeometry.dispose();
      issLabel.dispose();
      renderer.dispose();
      earthTexture.dispose();
      starfield.dispose();
    },
  };
}
