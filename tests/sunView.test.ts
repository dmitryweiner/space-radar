import { SUN_VIEW_HOME, clampSunView, panSunView, zoomSunViewAt } from '../src/scene/sunView';

describe('sunView', () => {
  it('zooms about the given point, keeping it fixed', () => {
    const view = zoomSunViewAt(SUN_VIEW_HOME, 2, 100, 0, 800);
    expect(view).toEqual({ scale: 2, x: -100, y: 0 });
    // The image point under (100, 0) before is still under it: (100 - x) / scale constant.
    expect((100 - view.x) / view.scale).toBe(100);
  });

  it('clamps scale and pan, snapping home at 1×', () => {
    expect(zoomSunViewAt(SUN_VIEW_HOME, 0.5, 0, 0, 800)).toEqual(SUN_VIEW_HOME);
    expect(zoomSunViewAt(SUN_VIEW_HOME, 100, 0, 0, 800).scale).toBe(8);
    expect(panSunView({ scale: 2, x: 0, y: 0 }, 5000, -5000, 800)).toEqual({ scale: 2, x: 800, y: -800 });
    expect(clampSunView({ scale: 1, x: 50, y: 50 }, 800)).toEqual(SUN_VIEW_HOME);
  });
});
