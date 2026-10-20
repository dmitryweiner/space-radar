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
// Module-level so the focus fallback can tell whether *any* canvas is hovered.
const hoveredCanvases = new Set<HTMLCanvasElement>();

// Keyboard +/- zoom for a 3D scene. Keys act on the canvas the pointer is over
// (works mid-rotation, no click needed); a click-focused canvas is the fallback
// target only when the pointer is over no scene, so two canvases never zoom at
// once. Zoom is deliberately not treated as "user interaction" for auto-rotate
// purposes — only a rotate/pan move stops the spin, see attachAutoRotate.
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

// Slow idle spin, in OrbitControls units (2.0 ≈ one turn per 30 s at 60 fps),
// so a fresh scene drifts gently until the user grabs it. Scaled by the global
// "Auto-rotate speed" setting via setSpeed.
const AUTO_ROTATE_SPEED = 0.4;

// OrbitControls' internal gesture states (see attachAutoRotate). The enum isn't
// exported by the OrbitControls module, so the values are hardcoded here with
// this comment as the source of truth.
const ORBIT_CONTROLS_NONE_STATE = -1;
const ORBIT_CONTROLS_DOLLY_STATE = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// OrbitControls tracks its current gesture in a plain `state` property
// (`this.state = _STATE.ROTATE` etc. at runtime) that isn't part of its
// public type declarations — read it structurally instead of an `as` cast.
function currentControlsState(controls: OrbitControls): unknown {
  return isRecord(controls) ? controls.state : undefined;
}

export interface AutoRotateHandle {
  /** Multiplies AUTO_ROTATE_SPEED (the global "Auto-rotate speed" setting);
   * 0 stops the spin. */
  setSpeed(multiplier: number): void;
  dispose(): void;
}

// Gently auto-rotate until the user actually moves the view (drag-rotate or
// drag-pan); zooming (wheel, trackpad pinch, keyboard +/-, or a middle-drag
// dolly) leaves it spinning. OrbitControls fires 'start' on any pointer
// interaction, but only *sets* its internal `state` for gestures that need to
// track motion across multiple events — a mouse-wheel/pinch zoom is a one-shot
// action handled inline in the wheel handler, which never touches `state`, so
// it fires 'start' with `state` left at NONE (-1); a middle-mouse-button-drag
// dolly *is* a multi-event drag, so it does get its own state, DOLLY (1). Both
// are zoom-only and must be excluded, or trackpad pinch-zoom (delivered as
// wheel events) stops the spin exactly like a real drag would. Two-finger
// touch gestures always mix a pinch with pan/rotate, so those still count as a
// move. The host must pass real elapsed seconds to controls.update(delta), or
// the spin speed follows the frame rate.
export function attachAutoRotate(controls: OrbitControls): AutoRotateHandle {
  controls.autoRotate = true;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  const stopAutoRotateOnMove = () => {
    const state = currentControlsState(controls);
    if (state !== ORBIT_CONTROLS_NONE_STATE && state !== ORBIT_CONTROLS_DOLLY_STATE) {
      controls.autoRotate = false;
    }
  };
  controls.addEventListener('start', stopAutoRotateOnMove);
  return {
    setSpeed(multiplier) {
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED * multiplier;
    },
    dispose() {
      controls.removeEventListener('start', stopAutoRotateOnMove);
    },
  };
}
