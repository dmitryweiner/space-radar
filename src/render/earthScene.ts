import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneVector3 } from '../astro/coords';
import earthTextureUrl from '../assets/earth-diffuse.jpg';
import { createStarfield } from './starfield';
import { makeLabelSprite, scaleLabelToScreen, type LabelSprite } from './labelSprite';
import { makeTrail, type TrailLine } from './trailLine';
import { attachKeyboardZoom } from './orbitControlsExtras';

export const EARTH_RADIUS_UNITS = 2;

// Slow idle spin, in OrbitControls units (2.0 ≈ one turn per 30 s at 60 fps),
// so a fresh globe drifts gently until the user grabs or zooms it.
const AUTO_ROTATE_SPEED = 0.4;

// Labels and markers keep a constant on-screen *pixel* size — unchanged by zoom
// and by expanding a card to full screen (see scaleLabelToScreen). Marker sizes
// below are on-screen radii in CSS pixels.
const LABEL_PX = 13;
const ISS_MARKER_PX = 5;
const SATELLITE_MARKER_PX = 2.4;
const EVENT_MARKER_PX = 3.2;
const FIRE_POINT_PX = 2.5;
const HOVER_LABEL_PX = 12;

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
  /** Optional detail shown in a tooltip when the point is hovered. */
  info?: string;
}

export interface EarthSceneHandle {
  setIssPosition(position: SceneVector3 | null, trail?: SceneVector3[]): void;
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

  // Gently auto-rotate until the user takes over (drags, wheels, or presses
  // +/-); OrbitControls fires 'start' on any pointer interaction.
  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  const stopAutoRotate = () => {
    controls.autoRotate = false;
  };
  controls.addEventListener('start', stopAutoRotate);
  const detachKeyboardZoom = attachKeyboardZoom(controls, camera, canvas, stopAutoRotate);

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
    new THREE.SphereGeometry(ISS_MARKER_RADIUS, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfab219 }),
  );
  issMarker.visible = false;
  scene.add(issMarker);
  const issLabel = makeLabelSprite('ISS', '#fab219');
  issLabel.sprite.visible = false;
  scene.add(issLabel.sprite);
  const issTrail = makeTrail(0xfab219);
  scene.add(issTrail.line);

  const SATELLITE_COLOR = 0x9fd8ff;
  const satelliteGeometry = new THREE.SphereGeometry(SATELLITE_MARKER_RADIUS, 8, 8);
  const satelliteMaterial = new THREE.MeshBasicMaterial({ color: SATELLITE_COLOR });
  const satelliteGroup = new THREE.Group();
  scene.add(satelliteGroup);
  const satelliteMarkers = new Map<string, { mesh: THREE.Mesh; label: LabelSprite; trail: TrailLine }>();

  const markerGeometry = new THREE.SphereGeometry(EVENT_MARKER_RADIUS, 12, 12);
  const markerGroup = new THREE.Group();
  scene.add(markerGroup);
  const eventMarkers = new Map<string, { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }>();

  let firePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null;
  let firePointInfos: string[] = [];

  const scratch = new THREE.Vector3();

  const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

  function rescaleLabel(label: LabelSprite, pixelHeight = LABEL_PX) {
    scaleLabelToScreen(label, camera, canvas.clientHeight, pixelHeight);
  }

  // Rescale a marker mesh so its rendered radius is `pxRadius` CSS pixels
  // regardless of camera distance — markers stay a constant on-screen size when
  // zooming, matching the labels.
  function scaleMarker(mesh: THREE.Object3D, pxRadius: number, baseRadius: number) {
    const distance = camera.position.distanceTo(mesh.position);
    const worldRadius = (pxRadius * 2 * FOV_TAN * distance) / Math.max(1, canvas.clientHeight);
    const s = worldRadius / baseRadius;
    mesh.scale.set(s, s, s);
  }

  // --- Fire-point hover tooltip -------------------------------------------
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = { threshold: 0.04 };
  const pointerNdc = new THREE.Vector2();
  const hoverScratch = new THREE.Vector3();
  let hoverLabel: LabelSprite | null = null;
  let hoverText = '';

  function clearHover() {
    if (hoverLabel) {
      scene.remove(hoverLabel.sprite);
      hoverLabel.dispose();
      hoverLabel = null;
    }
    hoverText = '';
    canvas.style.cursor = '';
  }

  // A fire point sits on the Earth's surface; it's only visible (hoverable)
  // when the camera is on the same side — i.e. above its local horizon.
  function isFacingCamera(point: THREE.Vector3): boolean {
    hoverScratch.copy(camera.position).sub(point);
    return hoverScratch.dot(point) > 0;
  }

  function onPointerMove(event: PointerEvent) {
    if (!firePoints || firePointInfos.length === 0) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster
      .intersectObject(firePoints)
      .find((intersection) => intersection.index !== undefined && isFacingCamera(intersection.point));
    if (!hit || hit.index === undefined) {
      clearHover();
      return;
    }
    const info = firePointInfos[hit.index] ?? '';
    if (!info) {
      clearHover();
      return;
    }
    canvas.style.cursor = 'pointer';
    if (info !== hoverText) {
      if (hoverLabel) {
        scene.remove(hoverLabel.sprite);
        hoverLabel.dispose();
      }
      hoverLabel = makeLabelSprite(info, '#ffd7a0');
      scene.add(hoverLabel.sprite);
      hoverText = info;
    }
    if (hoverLabel) {
      hoverLabel.sprite.position.copy(labelPosition({ x: hit.point.x, y: hit.point.y, z: hit.point.z }, scratch));
    }
  }

  function disposeSatellite(entry: { mesh: THREE.Mesh; label: LabelSprite; trail: TrailLine }) {
    satelliteGroup.remove(entry.mesh);
    scene.remove(entry.label.sprite);
    scene.remove(entry.trail.line);
    entry.label.dispose();
    entry.trail.dispose();
  }

  function disposeEventMarker(entry: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; label: LabelSprite }) {
    markerGroup.remove(entry.mesh);
    scene.remove(entry.label.sprite);
    entry.material.dispose();
    entry.label.dispose();
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', clearHover);

  let frameId = 0;
  function animate() {
    frameId = requestAnimationFrame(animate);
    controls.update();
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
    if (hoverLabel) {
      rescaleLabel(hoverLabel, HOVER_LABEL_PX);
    }
    renderer.render(scene, camera);
  }
  animate();

  return {
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
          satelliteGroup.add(mesh);
          const label = makeLabelSprite(name, '#9fd8ff');
          scene.add(label.sprite);
          const trailLine = makeTrail(SATELLITE_COLOR);
          scene.add(trailLine.line);
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
      clearHover();
      firePointInfos = points.map((point) => point.info ?? '');
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
      // sizeAttenuation:false keeps every fire point a constant on-screen size
      // when zooming; size is in framebuffer pixels, so scale by the pixel ratio
      // to land on the intended CSS-pixel size.
      const material = new THREE.PointsMaterial({
        size: FIRE_POINT_PX * renderer.getPixelRatio(),
        vertexColors: true,
        sizeAttenuation: false,
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
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', clearHover);
      clearHover();
      controls.removeEventListener('start', stopAutoRotate);
      detachKeyboardZoom();
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
      issTrail.dispose();
      renderer.dispose();
      earthTexture.dispose();
      starfield.dispose();
    },
  };
}
