// Pan/zoom state of the Sun tab's disk view, as pure functions (unit-tested).
// `x`/`y` = offset in CSS px of the image centre from the viewport centre;
// `scale` = zoom relative to the image fitting the viewport.

export interface SunView {
  scale: number;
  x: number;
  y: number;
}

export const SUN_VIEW_HOME: SunView = { scale: 1, x: 0, y: 0 };
export const MIN_SUN_SCALE = 1;
export const MAX_SUN_SCALE = 8;

/** Keep at least half of the image on screen: |offset| ≤ half the zoomed size. */
export function clampSunView(view: SunView, baseSize: number): SunView {
  const scale = Math.min(MAX_SUN_SCALE, Math.max(MIN_SUN_SCALE, view.scale));
  const limit = (baseSize * scale) / 2;
  const clamp = (v: number) => Math.min(limit, Math.max(-limit, v));
  return scale === MIN_SUN_SCALE ? SUN_VIEW_HOME : { scale, x: clamp(view.x), y: clamp(view.y) };
}

/** Zoom by `factor` keeping the point (px, py) — relative to the viewport centre — fixed. */
export function zoomSunViewAt(view: SunView, factor: number, px: number, py: number, baseSize: number): SunView {
  const scale = Math.min(MAX_SUN_SCALE, Math.max(MIN_SUN_SCALE, view.scale * factor));
  const ratio = scale / view.scale;
  return clampSunView({ scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, baseSize);
}

export function panSunView(view: SunView, dx: number, dy: number, baseSize: number): SunView {
  return clampSunView({ ...view, x: view.x + dx, y: view.y + dy }, baseSize);
}
