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

// Canvases the pointer is currently over. Routing zoom by hover (rather than DOM
// focus) is what makes the keys work while a globe is *still auto-rotating*:
// focus can only be gained by clicking, and clicking also stops the spin — so a
// focus-only scheme means the keys never fire until rotation has been stopped.
// Module-level so the focus fallback can tell whether *any* card is hovered.
const hoveredCanvases = new Set<HTMLCanvasElement>();

// Keyboard +/- zoom for a 3D card. Keys act on the card the pointer is over
// (works mid-rotation, no click needed); a click-focused card is the fallback
// target only when the pointer is over no globe, so two cards never zoom at
// once. `onInteract` lets the caller treat a zoom as user input (e.g. to stop
// auto-rotation). Returns a cleanup function.
export function attachKeyboardZoom(
  controls: OrbitControls,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  onInteract?: () => void,
): () => void {
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';

  const onEnter = () => hoveredCanvases.add(canvas);
  const onLeave = () => hoveredCanvases.delete(canvas);
  const onPointerDown = () => canvas.focus();

  function shouldHandle(): boolean {
    if (hoveredCanvases.has(canvas)) {
      return true;
    }
    return document.activeElement === canvas && hoveredCanvases.size === 0;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!shouldHandle()) {
      return;
    }
    let factor: number;
    if (event.key === '+' || event.key === '=') {
      factor = ZOOM_STEP;
    } else if (event.key === '-' || event.key === '_') {
      factor = 1 / ZOOM_STEP;
    } else {
      return;
    }
    event.preventDefault();
    dolly(controls, camera, factor);
    onInteract?.();
  }

  canvas.addEventListener('pointerenter', onEnter);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    hoveredCanvases.delete(canvas);
    canvas.removeEventListener('pointerenter', onEnter);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('keydown', onKeyDown);
  };
}
