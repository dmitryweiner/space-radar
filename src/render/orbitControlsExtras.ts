import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Multiply the camera→target distance by this on '+', and by its reciprocal on
// '-'. 0.85 is a comfortable ~15% step per key press.
const ZOOM_STEP = 0.85;

// Move the camera toward (factor < 1) or away from (factor > 1) the orbit
// target, clamped to the controls' configured distance limits.
function dolly(controls: OrbitControls, camera: PerspectiveCamera, factor: number): void {
  const offset = camera.position.clone().sub(controls.target);
  const distance = Math.min(controls.maxDistance, Math.max(controls.minDistance, offset.length() * factor));
  offset.setLength(distance);
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

// One zoom step in/out — shared by the keyboard handler and the on-screen
// +/- buttons so both take the same ~15% step and honour the distance clamps.
export function zoomBy(controls: OrbitControls, camera: PerspectiveCamera, direction: 'in' | 'out'): void {
  dolly(controls, camera, direction === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP);
}

// Keyboard +/- zoom for a 3D card. The canvas is made focusable so the keys
// only affect the card the user has clicked into, rather than every globe on
// the page at once. `onInteract` lets the caller treat a keyboard zoom as user
// input (e.g. to stop auto-rotation). Returns a cleanup function.
export function attachKeyboardZoom(
  controls: OrbitControls,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  onInteract?: () => void,
): () => void {
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';

  function onKeyDown(event: KeyboardEvent) {
    let direction: 'in' | 'out';
    if (event.key === '+' || event.key === '=') {
      direction = 'in';
    } else if (event.key === '-' || event.key === '_') {
      direction = 'out';
    } else {
      return;
    }
    event.preventDefault();
    zoomBy(controls, camera, direction);
    onInteract?.();
  }

  canvas.addEventListener('keydown', onKeyDown);
  return () => canvas.removeEventListener('keydown', onKeyDown);
}
