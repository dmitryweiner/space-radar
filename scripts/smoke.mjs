#!/usr/bin/env node
// Browser smoke test: WebGL scenes, gestures and real layout can't be exercised
// in vitest (jsdom has none of them), so we drive a real Chromium instance here
// instead. Covers the Scene view: one shared globe with default layers, layer
// toggles persisting, the globe rendering, a status chip opening its inspector
// panel, the time scrubber, the Earth/Sun/Solar System tabs, hover-routed
// keyboard zoom, Solar System fly-to, auto-rotate stop-only-on-move, the
// general settings popup, the Earth style select, and the phone layout
// (one-finger rotate + bottom sheet, a panel's × returning to the list).
//
//   node scripts/smoke.mjs                    # full smoke
//   node scripts/smoke.mjs --screenshot shots/smoke.png
//   node scripts/smoke.mjs --preview          # prod build (vite preview :4173)
//
// Any console/page error -> non-zero exit code (CI-friendly).

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { ensureServer } from './devServer.mjs';
import { countDiffPixels } from './pngDiff.mjs';

const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(['screenshot']);
const flags = new Map();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const name = a.slice(2);
    flags.set(name, VALUE_FLAGS.has(name) ? args[++i] : 'true');
  }
}

const preview = flags.has('preview');

const errors = [];
let ctxLabel = 'app';
// Live external APIs (NASA key, NOAA) occasionally answer with 4xx/5xx or
// even fail outright (e.g. NeoWs' backend returning an error page with no
// CORS headers, which Chromium reports as a blocked-by-CORS console error)
// during a smoke run. The app handles all of this gracefully (renders an
// error message, doesn't throw) — that's expected network noise, not a bug.
const IGNORED_CONSOLE_PATTERN = /Failed to load resource|blocked by CORS policy/;

function attach(page) {
  page.on('pageerror', (e) => errors.push(`[${ctxLabel}] ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED_CONSOLE_PATTERN.test(m.text())) errors.push(`[${ctxLabel}] ${m.text()}`);
  });
}

// Poll a canvas until two screenshots `windowMs` apart differ by fewer than
// `threshold` pixels, or `maxMs` runs out; returns the last diff. OrbitControls'
// damping decays *per frame*, and on headless Chromium's software rasterizer
// the frame rate is low — so a fixed "wait 2s" settle isn't reliable.
async function settledDiff(locator, threshold, { windowMs = 600, maxMs = 10000 } = {}) {
  const deadline = Date.now() + maxMs;
  let diff = Infinity;
  while (Date.now() < deadline) {
    const before = await locator.screenshot();
    await locator.page().waitForTimeout(windowMs);
    diff = countDiffPixels(before, await locator.screenshot());
    if (diff < threshold) break;
  }
  return diff;
}

const { base: BASE, stop: stopServer } = await ensureServer({ preview });
const browser = await chromium.launch();

// ---------------------------------------------------------------- Scene view
ctxLabel = 'scene';
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
attach(page);
{
  const scenePage = page;
  await scenePage.goto(BASE);
  await scenePage.waitForSelector('[data-testid="scene-view"]');
  await scenePage.waitForTimeout(1500);

  const canvases = await scenePage.locator('canvas').count();
  if (canvases !== 1) errors.push(`[scene] expected exactly one WebGL canvas (one shared globe), got ${canvases}`);
  for (const name of ['ISS & satellites', 'Aurora oval', 'Earthquakes', 'Natural events']) {
    if (!(await scenePage.getByRole('checkbox', { name }).isChecked())) errors.push(`[scene] layer "${name}" should be on by default`);
  }
  if ((await scenePage.getByTestId('status-bar').locator('.status-chip').count()) < 5) errors.push('[scene] status bar has too few chips');

  // a layer toggle persists across reload
  await scenePage.getByRole('checkbox', { name: 'Active fires' }).click();
  await scenePage.reload();
  await scenePage.waitForSelector('[data-testid="scene-view"]');
  if (!(await scenePage.getByRole('checkbox', { name: 'Active fires' }).isChecked())) errors.push('[scene] layer toggle did not persist');
  else console.log('scene: one globe, default layers, toggle persists ok');

  // the globe really renders: something on the canvas changes while it spins
  const sceneCanvas = scenePage.getByTestId('scene-canvas');
  const spinBefore = await sceneCanvas.screenshot();
  await scenePage.waitForTimeout(800);
  const spinDiff = countDiffPixels(spinBefore, await sceneCanvas.screenshot());
  if (spinDiff < 1000) errors.push(`[scene] globe does not appear to render/spin (diff=${spinDiff})`);

  // status chip → inspector panel
  await scenePage.getByRole('button', { name: /^Kp/ }).click();
  if ((await scenePage.locator('.inspector-title').textContent()) !== 'Geomagnetic activity (Kp)') errors.push('[scene] Kp chip did not open its panel');
  await scenePage.getByRole('button', { name: 'Close panel' }).click();

  // time scrubber: moving off "Live" and back
  const range = scenePage.getByRole('slider', { name: 'Time offset from now' });
  await range.focus();
  for (let i = 0; i < 40; i++) await range.press('ArrowRight');
  const liveBtn = scenePage.getByRole('button', { name: 'Live' });
  if ((await liveBtn.getAttribute('aria-pressed')) !== 'false') errors.push('[scene] scrubbing did not leave Live mode');
  const offsetText = await scenePage.locator('.time-offset').textContent().catch(() => null);
  if (!offsetText || !offsetText.includes('+')) errors.push(`[scene] scrubbed time shows no +offset: ${offsetText}`);
  await liveBtn.click();
  if ((await liveBtn.getAttribute('aria-pressed')) !== 'true') errors.push('[scene] Live button did not return to live');
  else console.log('scene: scrubber leaves/returns to live ok, offset', offsetText);

  // the other scenes mount; back to Earth remounts the globe
  await scenePage.getByRole('tab', { name: 'Solar System' }).click();
  await scenePage.waitForTimeout(500);
  if ((await scenePage.locator('.solar-system-canvas').count()) !== 1) errors.push('[scene] Solar System scene has no canvas');
  await scenePage.getByRole('tab', { name: 'Sun' }).click();
  await scenePage.waitForTimeout(300);
  if ((await scenePage.locator('.sun-stage img').count()) < 1) errors.push('[scene] Sun scene shows no image');
  await scenePage.getByRole('tab', { name: 'Earth' }).click();
  await scenePage.waitForTimeout(500);
  if ((await scenePage.getByTestId('scene-canvas').count()) !== 1) errors.push('[scene] Earth globe did not come back');
  else console.log('scene: Earth / Sun / Solar System tabs ok');

}

// keyboard +/- zoom must work on hover alone — no click needed — so it also
// works while a globe is still auto-rotating (clicking would stop the spin).
// The Solar System scene has no auto-rotate, so any change between the
// before/after capture is the zoom itself.
ctxLabel = 'keyboard-zoom';
{
  await page.getByRole('tab', { name: 'Solar System' }).click();
  await page.waitForTimeout(800);
  const zoomCanvas = page.locator('.solar-system-canvas');
  const before = await zoomCanvas.screenshot();
  await zoomCanvas.hover();
  for (let i = 0; i < 6; i++) await page.keyboard.press('=');
  await page.waitForTimeout(300);
  const after = await zoomCanvas.screenshot();
  if (countDiffPixels(before, after) < 1000) errors.push('[keyboard-zoom] hover + "+" did not change the solar-system view');
  else console.log('keyboard zoom ok');

  // fly-to: a body chip focuses the camera on it (overlay names it, the view
  // changes), "Whole system" flies back out
  const flyBefore = await zoomCanvas.screenshot();
  await page.locator('.body-chip', { hasText: /^Saturn$/ }).click();
  await page.waitForTimeout(1500);
  const flyDiff = countDiffPixels(flyBefore, await zoomCanvas.screenshot());
  if ((await page.locator('.solar-focus-name').textContent()) !== 'Saturn') errors.push('[fly-to] overlay does not name Saturn');
  else if (flyDiff < 10000) errors.push(`[fly-to] view barely changed flying to Saturn (diff=${flyDiff})`);
  else console.log('fly-to: Saturn ok, diff=', flyDiff);
  await page.getByRole('button', { name: '← Whole system' }).click();
  await page.waitForTimeout(300);
  if ((await page.locator('.solar-focus-name').count()) !== 0) errors.push('[fly-to] "Whole system" did not leave the focus');

  // Solar System data layers: on by default; switching one off removes its
  // fly-to chips. (Their data needs the deployed proxy — JPL sends no CORS —
  // so only the UI is checked here.)
  for (const name of ['Spacecraft', 'Asteroid flybys', 'Comets']) {
    if (!(await page.getByRole('checkbox', { name }).isChecked())) errors.push(`[solar-layers] "${name}" should be on by default`);
  }
  await page.getByRole('checkbox', { name: 'Spacecraft' }).uncheck();
  if ((await page.locator('.body-chip', { hasText: /^Voyager 1$/ }).count()) !== 0) errors.push('[solar-layers] spacecraft chips stayed after switching the layer off');
  await page.getByRole('checkbox', { name: 'Spacecraft' }).check();
  if ((await page.locator('.body-chip', { hasText: /^Voyager 1$/ }).count()) !== 1) errors.push('[solar-layers] spacecraft chips missing');
  else console.log('solar-layers: toggles + spacecraft chips ok');

  await page.getByRole('tab', { name: 'Earth' }).click();
  await page.waitForSelector('[data-testid="scene-canvas"]');
}

// The ISS/satellite markers move every second, so a globe with that layer on
// never looks static — switch it off for the "did the spin stop" checks below.
await page.getByRole('checkbox', { name: 'ISS & satellites' }).uncheck();
await page.waitForTimeout(1500);

// auto-rotate: zooming (keyboard +/- or wheel) must leave it spinning; a
// rotate/pan press must stop it. Exact-byte screenshot equality is too
// sensitive to use here — the headless-Chromium software rasterizer leaves
// a small amount of frame-to-frame dithering noise on these canvases
// (transparent label sprites + wireframe grid) even when nothing moved, so
// `Buffer.equals()` never reliably reports "unchanged". countDiffPixels
// (scripts/pngDiff.mjs) instead measures *how many* pixels moved, which
// gives a clean, calibrated signal: genuine rotation moves on the order of
// 10,000+ pixels per 600ms even at this scene's slow idle-spin speed, while
// that dithering noise is only a handful — nowhere near either threshold
// below.
ctxLabel = 'auto-rotate';
{
  const SPINNING_DIFF_PX = 3000;
  const SETTLED_DIFF_PX = 1000;
  const globeCanvas = page.getByTestId('scene-canvas');
  const box = await globeCanvas.boundingBox();

  async function diffOverWindow(ms) {
    const before = await globeCanvas.screenshot();
    await page.waitForTimeout(ms);
    const after = await globeCanvas.screenshot();
    return countDiffPixels(before, after);
  }

  const atRestDiff = await diffOverWindow(600);
  if (atRestDiff < SPINNING_DIFF_PX) errors.push(`[auto-rotate] globe is not auto-rotating at rest (diff=${atRestDiff})`);
  else console.log('auto-rotate: spinning at rest ok, diff=', atRestDiff);

  await globeCanvas.hover();
  // Only a few presses: zoomed all the way in (MIN_CAMERA_DISTANCE), the view
  // can be filled by the unlit night side, where a spinning globe is a black
  // screen and reads as "stopped".
  for (let i = 0; i < 4; i++) await page.keyboard.press('=');
  const afterKeyboardZoomDiff = await diffOverWindow(600);
  if (afterKeyboardZoomDiff < SPINNING_DIFF_PX) {
    errors.push(`[auto-rotate] keyboard zoom stopped auto-rotation (diff=${afterKeyboardZoomDiff})`);
  } else {
    console.log('auto-rotate: keyboard zoom does not stop it ok, diff=', afterKeyboardZoomDiff);
  }

  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
  }
  const afterWheelZoomDiff = await diffOverWindow(600);
  if (afterWheelZoomDiff < SPINNING_DIFF_PX) {
    errors.push(`[auto-rotate] wheel zoom stopped auto-rotation (diff=${afterWheelZoomDiff})`);
  } else {
    console.log('auto-rotate: wheel zoom does not stop it ok, diff=', afterWheelZoomDiff);
  }

  if (!box) {
    errors.push('[auto-rotate] globe canvas not found for a rotate/pan press');
  } else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    // OrbitControls' damping keeps easing the camera for a bit after release
    // even with autoRotate now off — wait for that "coast" to decay (see
    // settledDiff); a still-spinning globe never gets under the threshold.
    const afterPressDiff = await settledDiff(globeCanvas, SETTLED_DIFF_PX);
    if (afterPressDiff >= SETTLED_DIFF_PX) {
      errors.push(`[auto-rotate] a rotate/pan press did not stop auto-rotation (diff=${afterPressDiff})`);
    } else {
      console.log('auto-rotate: press stops it ok, diff=', afterPressDiff);
    }
  }
}

// general settings popup: opens, edits label scale / rotate speed, rotate
// speed 0 really stops the spin, and the values survive a reload via their own
// localStorage key. Reload first: the press above already stopped the spin.
ctxLabel = 'global-settings';
{
  await page.reload();
  await page.waitForSelector('[data-testid="scene-view"]');
  await page.waitForTimeout(1000);
  await page.locator('#generalSettingsBtn').click();
  await page.waitForTimeout(150);
  const popup = page.getByTestId('global-settings-popup');
  if ((await popup.count()) !== 1) {
    errors.push('[global-settings] popup did not open');
  } else {
    // Range inputs aren't fill()-able in Playwright — Home/ArrowRight moves
    // the slider by exact `step` increments, landing on a known value
    // regardless of where it started (LABEL_SCALE_MIN=0.5, step=0.1: Home + 11
    // steps of 0.1 = 1.6; ROTATE_SPEED_MIN=0: Home alone is already 0).
    const labelScaleInput = popup.locator('#global-setting-label-scale');
    await labelScaleInput.focus();
    await labelScaleInput.press('Home');
    for (let i = 0; i < 11; i++) await labelScaleInput.press('ArrowRight');
    const rotateSpeedInput = popup.locator('#global-setting-rotate-speed');
    await rotateSpeedInput.focus();
    await rotateSpeedInput.press('Home');
    await page.waitForTimeout(150);
    // The backdrop covers the whole viewport — close via its own button.
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.waitForTimeout(300);

    const stoppedDiff = await settledDiff(page.getByTestId('scene-canvas'), 500);
    if (stoppedDiff >= 500) errors.push(`[global-settings] rotate speed 0 did not stop the spin (diff=${stoppedDiff})`);
    else console.log('global-settings: rotate speed 0 stops the spin ok, diff=', stoppedDiff);

    await page.reload();
    await page.waitForSelector('[data-testid="scene-view"]');
    await page.waitForTimeout(500);
    await page.locator('#generalSettingsBtn').click();
    await page.waitForTimeout(150);
    const reopenedLabelScale = await page.locator('#global-setting-label-scale').inputValue();
    const reopenedRotateSpeed = await page.locator('#global-setting-rotate-speed').inputValue();
    if (reopenedLabelScale !== '1.6' || reopenedRotateSpeed !== '0') {
      errors.push(
        `[global-settings] settings did not survive reload: labelScale=${reopenedLabelScale} rotateSpeed=${reopenedRotateSpeed}`,
      );
    } else {
      console.log('global-settings: opens, edits, persists ok');
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    if ((await popup.count()) !== 0) errors.push('[global-settings] Escape did not close the popup');

    // Local time reaches the scrubber's label; data saver toggles without errors.
    const scrubberLabel = () => page.locator('.time-scrubber').innerText();
    await page.locator('#generalSettingsBtn').click();
    await page.locator('#global-setting-time-zone-local').check();
    await page.locator('#global-setting-data-saver').check();
    await page.waitForTimeout(300);
    const localLabel = await scrubberLabel();
    await page.locator('#global-setting-time-zone-utc').check();
    await page.locator('#global-setting-data-saver').uncheck();
    await page.keyboard.press('Escape');
    if (/UTC/.test(localLabel)) errors.push(`[global-settings] local time did not reach the scrubber: ${localLabel}`);
    else console.log('global-settings: local time + data saver ok');
  }
}

// Earth style: switching the globe to the flat map must not throw.
ctxLabel = 'earth-style';
{
  const mapOption = page.locator('#scene-earth-style-map');
  if ((await mapOption.count()) !== 1) {
    errors.push('[earth-style] map option not found in the layer panel');
  } else {
    await mapOption.check();
    await page.waitForTimeout(300);
    if (!(await mapOption.isChecked())) errors.push('[earth-style] map option did not become checked');
    else console.log('earth-style: switched to flat map ok');
    await page.locator('#scene-earth-style-globe').check();
  }
}

// Scene view on a phone: the page itself never scrolls, so one finger rotates
// the globe (data-free-gestures); layers live in a bottom sheet.
ctxLabel = 'scene-phone';
{
  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await phoneContext.newPage();
  attach(phone);
  await phone.goto(BASE);
  await phone.waitForSelector('[data-testid="scene-view"]');
  await phone.waitForTimeout(1500);
  const cdp = await phoneContext.newCDPSession(phone);
  const globe = phone.getByTestId('scene-canvas');
  const box = await globe.boundingBox();
  if (!box) {
    errors.push('[scene-phone] globe canvas not found');
  } else {
    const docScroll = () => phone.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
    const before = await globe.screenshot();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 0 }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 10, y: cy, id: 0 }] });
      await phone.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await phone.waitForTimeout(400);
    const diff = countDiffPixels(before, await globe.screenshot());
    if (diff < 3000) errors.push(`[scene-phone] one-finger drag did not rotate the full-screen globe (diff=${diff})`);
    if ((await docScroll()) !== 0) errors.push('[scene-phone] the page scrolled in Scene view');
    if ((await phone.locator('.gesture-hint-visible').count()) !== 0) errors.push('[scene-phone] "two fingers" hint shown in Scene view');
    if (diff >= 3000) console.log('scene-phone: one finger rotates the globe, page static ok, diff=', diff);
  }
  await phone.locator('.scene-sheet-tabs').getByRole('button', { name: 'Layers' }).click();
  if (!(await phone.getByRole('checkbox', { name: 'Earthquakes' }).isVisible())) errors.push('[scene-phone] Layers sheet did not open');
  else console.log('scene-phone: layers bottom sheet ok');
  // An open panel keeps its × in view, and × goes back to the list — it
  // doesn't close the whole sheet.
  await phone.locator('.scene-sheet-tabs').getByRole('button', { name: 'Details' }).click();
  await phone.locator('.panel-link', { hasText: 'Upcoming launches' }).click();
  const closePanel = phone.getByRole('button', { name: 'Close panel' });
  if (!(await closePanel.isVisible())) errors.push('[scene-phone] open panel has no visible × button');
  else {
    await closePanel.click();
    if (!(await phone.locator('.scene-sheet-body .panel-link').first().isVisible()))
      errors.push('[scene-phone] × on a panel did not return to the Details list');
    else console.log('scene-phone: panel × returns to the Details list ok');
  }
  await phoneContext.close();
}

if (flags.has('screenshot')) {
  const path = flags.get('screenshot');
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  console.log(path);
}

console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
stopServer();
process.exit(errors.length ? 2 : 0);
