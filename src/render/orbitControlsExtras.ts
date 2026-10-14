import { TOUCH, type PerspectiveCamera } from 'three';
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
// once. Zoom is deliberately not treated as "user interaction" for auto-rotate
// purposes — only a rotate/pan move stops the spin, see earthScene.ts.
// Returns a cleanup function.
export function attachKeyboardZoom(
  controls: OrbitControls,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
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

// How long the "use two fingers" hint stays up after a one-finger swipe.
const GESTURE_HINT_MS = 1500;

// Map-style "cooperative" touch gestures on coarse-pointer (touch) devices: one
// finger scrolls the page, two fingers rotate (move) + zoom (pinch) the scene.
// Without this OrbitControls sets `touch-action: none` and claims every
// one-finger swipe as a rotation — on a phone the globes fill nearly the whole
// width, so the page becomes almost impossible to scroll.
//
// Cooperative mode is off (one finger rotates, as before) whenever the canvas
// sits inside an element marked `data-free-gestures` — the full-screen card
// overlay and the full-page Scene view, where there is nothing to scroll. It's
// decided per touch, so a card moving into/out of full screen needs no wiring.
// The page-scroll half is CSS (`.coop-gestures` → `touch-action: pan-y`, see
// style.css) since the browser reads `touch-action` before any JS runs.
// Returns a cleanup function.
export function attachCooperativeGestures(controls: OrbitControls, canvas: HTMLCanvasElement): () => void {
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  // OrbitControls.connect() hard-codes an inline `touch-action: none`; clear it
  // so the stylesheet rule can apply.
  canvas.style.touchAction = '';
  canvas.classList.add('coop-gestures');
  controls.touches.TWO = TOUCH.DOLLY_ROTATE;

  function isCooperative(): boolean {
    return coarsePointer.matches && canvas.closest('[data-free-gestures]') === null;
  }

  // Capture phase so it runs before OrbitControls' own pointerdown listener
  // reads `touches.ONE` for this very touch.
  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      controls.touches.ONE = isCooperative() ? null : TOUCH.ROTATE;
    }
  }

  let hint: HTMLDivElement | null = null;
  let hintTimer = 0;
  function showHint() {
    const host = canvas.parentElement;
    if (!host) {
      return;
    }
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'gesture-hint';
      hint.textContent = 'Use two fingers to rotate';
      host.appendChild(hint);
    }
    hint.classList.add('gesture-hint-visible');
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hint?.classList.remove('gesture-hint-visible'), GESTURE_HINT_MS);
  }

  function onTouchMove(event: TouchEvent) {
    if (!isCooperative()) {
      return;
    }
    if (event.touches.length >= 2) {
      // `pan-y` would otherwise let the browser scroll the page on a vertical
      // two-finger drag, cancelling the rotation mid-gesture.
      event.preventDefault();
    } else {
      showHint();
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  return () => {
    window.clearTimeout(hintTimer);
    hint?.remove();
    canvas.classList.remove('coop-gestures');
    canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
    canvas.removeEventListener('touchmove', onTouchMove);
  };
}
