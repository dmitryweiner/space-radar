// The data-saver setting's rendering half, shared by both 3D scenes: a 30 fps
// cap and a 1× pixel ratio (a 3× phone otherwise renders 4× the pixels of 1.5×).

const LOW_POWER_FPS = 30;
// A little slack so a 60 Hz display reliably renders every other frame
// rather than drifting between every 2nd and 3rd.
const FRAME_SLACK_MS = 2;

export function pixelRatioFor(lowPower: boolean): number {
  return lowPower ? 1 : Math.min(window.devicePixelRatio, 2);
}

export interface FrameGate {
  setLowPower(lowPower: boolean): void;
  /** Call once per animation frame; false = skip rendering this one. */
  shouldRender(nowMs: number): boolean;
}

export function createFrameGate(): FrameGate {
  let lowPower = false;
  let lastMs = -Infinity;
  return {
    setLowPower(value) {
      lowPower = value;
    },
    shouldRender(nowMs) {
      if (!lowPower) return true;
      if (nowMs - lastMs < 1000 / LOW_POWER_FPS - FRAME_SLACK_MS) return false;
      lastMs = nowMs;
      return true;
    },
  };
}
