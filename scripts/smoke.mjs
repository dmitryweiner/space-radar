#!/usr/bin/env node
// Browser smoke test: the grid/drag/resize/3D layers can't be exercised in
// vitest (jsdom has no real layout engine or WebGL), so we drive a real
// Chromium instance here instead. Covers: default card visibility, toggling
// cards via the menu, canvases mounting for the 3D cards, drag-to-reposition,
// resize, localStorage persistence across reload, and layout reset.
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

const DEFAULT_VISIBLE = ['iss-globe', 'solar-system', 'natural-events', 'apod', 'launches', 'asteroids'];
const HIDDEN_BY_DEFAULT = [
  'kp-index',
  'solar-wind',
  'aurora-forecast',
  'solar-flares',
  'fire-map',
  'epic',
  'quakes',
  'solar-imagery',
  'solar-cycle',
  'moon',
  'aurora-globe',
  'nasa-images',
];
const ALL_CARDS = [...DEFAULT_VISIBLE, ...HIDDEN_BY_DEFAULT];
// Cards that mount a WebGL <canvas> (globe / solar-system scenes).
const CANVAS_CARDS = ['iss-globe', 'solar-system', 'natural-events', 'fire-map', 'quakes', 'aurora-globe'];
const CARD_TITLES = {
  'iss-globe': 'ISS & Satellites',
  'solar-system': 'Solar System',
  'kp-index': 'Geomagnetic Activity (Kp-index)',
  'solar-wind': 'Solar Wind',
  'aurora-forecast': 'Aurora Forecast',
  'solar-flares': 'Solar Flares & CME',
  asteroids: 'Near-Earth Asteroids',
  'natural-events': 'Natural Events (EONET)',
  launches: 'Upcoming Launches',
  apod: 'Astronomy Picture of the Day',
  'fire-map': 'Active Fires (FIRMS)',
  epic: 'Earth from L1 (EPIC)',
  quakes: 'Earthquakes (USGS)',
  'solar-imagery': 'Live Sun (SDO)',
  'solar-cycle': 'Solar Cycle',
  moon: 'Moon & Eclipses',
  'aurora-globe': 'Aurora Oval (3D)',
  'nasa-images': 'NASA Image Library',
};


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

async function visibleCardIds(page) {
  return page.$$eval('[data-card-id]', (els) => els.map((e) => e.getAttribute('data-card-id')));
}

async function cardStyle(page, id, prop) {
  return page.$eval(`[data-card-id="${id}"]`, (el, p) => el.style[p] ?? null, prop);
}

// Poll a canvas until two screenshots `windowMs` apart differ by fewer than
// `threshold` pixels, or `maxMs` runs out; returns the last diff. OrbitControls'
// damping decays *per frame*, and with several WebGL cards sharing headless
// Chromium's software rasterizer the frame rate drops a lot — so a fixed
// "wait 2s" settle that's plenty with one card open isn't with six.
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
attach(page);

await page.goto(BASE);
await page.waitForSelector('#app');
await page.waitForTimeout(500);

// default visibility
ctxLabel = 'default-visibility';
let visible = await visibleCardIds(page);
for (const id of DEFAULT_VISIBLE) {
  if (!visible.includes(id)) errors.push(`[default-visibility] expected "${id}" visible by default`);
}
for (const id of HIDDEN_BY_DEFAULT) {
  if (visible.includes(id)) errors.push(`[default-visibility] expected "${id}" hidden by default`);
}
console.log('default visibility ok:', visible);

// open the Cards menu, toggle every hidden card on
ctxLabel = 'toggle-cards';
await page.locator('#cardsMenuBtn').click();
await page.waitForTimeout(150);
for (const id of ALL_CARDS) {
  const title = CARD_TITLES[id];
  const checkbox = page.getByRole('checkbox', { name: title });
  if ((await checkbox.count()) !== 1) errors.push(`[toggle-cards] checkbox for "${title}" not found`);
}
for (const id of HIDDEN_BY_DEFAULT) {
  await page.getByRole('checkbox', { name: CARD_TITLES[id] }).click();
}
await page.locator('#cardsMenuBtn').click();
await page.waitForTimeout(300);

visible = await visibleCardIds(page);
for (const id of ALL_CARDS) {
  if (!visible.includes(id)) errors.push(`[toggle-cards] "${id}" should be visible after toggling on`);
}
console.log('all cards toggled visible:', visible.length === ALL_CARDS.length);

// 3D cards mount a canvas
ctxLabel = '3d-canvases';
await page.waitForTimeout(500);
for (const id of CANVAS_CARDS) {
  const canvasCount = await page.locator(`[data-card-id="${id}"] canvas`).count();
  if (canvasCount < 1) errors.push(`[3d-canvases] no canvas rendered for "${id}"`);
}
console.log('3D canvases present');

// keyboard +/- zoom must work on hover alone — no click needed — so it also
// works while a globe is still auto-rotating (clicking would stop the spin).
// Only hover (not click) here; solar-system has no auto-rotate, so any change
// between the before/after canvas capture is the zoom itself.
ctxLabel = 'keyboard-zoom';
{
  const zoomCanvas = page.locator('[data-card-id="solar-system"] canvas');
  await zoomCanvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const before = await zoomCanvas.screenshot();
  await zoomCanvas.hover();
  for (let i = 0; i < 6; i++) await page.keyboard.press('=');
  await page.waitForTimeout(300);
  const after = await zoomCanvas.screenshot();
  if (before.equals(after)) errors.push('[keyboard-zoom] hover + "+" did not change the solar-system view');
}
console.log('keyboard zoom ok');

// let API-backed cards settle (data or a graceful error, no thrown errors)
await page.waitForTimeout(3000);

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
  const globeCanvas = page.locator('[data-card-id="aurora-globe"] canvas');
  await globeCanvas.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
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

// drag the Kp-index card by its header to a new position
ctxLabel = 'drag';
const beforeTransform = await cardStyle(page, 'kp-index', 'transform');
const handle = page.locator('[data-card-id="kp-index"] .card-drag-handle');
await handle.scrollIntoViewIfNeeded();
const handleBox = await handle.boundingBox();
if (!handleBox) {
  errors.push('[drag] drag handle not found');
} else {
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 250, startY + 200, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterTransform = await cardStyle(page, 'kp-index', 'transform');
  if (afterTransform === beforeTransform) errors.push('[drag] card position did not change after dragging');
  else console.log('drag ok:', beforeTransform, '->', afterTransform);
}

// resize the Solar Wind card via its resize handle. Per CLAUDE.md: the
// horizontal delta must exceed one full column width, so measure the column
// from the grid container instead of guessing a pixel delta.
ctxLabel = 'resize';
const beforeWidth = await cardStyle(page, 'solar-wind', 'width');
const beforeTransformSw = await cardStyle(page, 'solar-wind', 'transform');
const gridBox = await page.locator('.grid-layout-container').boundingBox();
const columnWidth = gridBox ? gridBox.width / 4 : 340;
const resizeHandle = page.locator('[data-card-id="solar-wind"] .react-resizable-handle');
// The handle can sit below the fold once taller cards push the grid down —
// mouse events at off-viewport coordinates silently hit nothing.
await resizeHandle.scrollIntoViewIfNeeded();
const resizeBox = await resizeHandle.boundingBox();
if (!resizeBox) {
  errors.push('[resize] resize handle not found');
} else {
  const startX = resizeBox.x + resizeBox.width / 2;
  const startY = resizeBox.y + resizeBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + columnWidth * 1.2, startY + 20, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterWidth = await cardStyle(page, 'solar-wind', 'width');
  if (afterWidth === beforeWidth) {
    errors.push(
      `[resize] card width did not change after resizing (at ${beforeTransformSw}, column ${columnWidth.toFixed(0)}px)`,
    );
  } else console.log('resize ok:', beforeWidth, '->', afterWidth);
}

// reload: layout + visibility should persist via localStorage
ctxLabel = 'persistence';
const transformBeforeReload = await cardStyle(page, 'kp-index', 'transform');
await page.reload();
await page.waitForSelector('#app');
await page.waitForTimeout(500);
const visibleAfterReload = await visibleCardIds(page);
if (visibleAfterReload.length !== ALL_CARDS.length) {
  errors.push(`[persistence] expected ${ALL_CARDS.length} visible cards after reload, got ${visibleAfterReload.length}`);
}
const transformAfterReload = await cardStyle(page, 'kp-index', 'transform');
if (transformAfterReload !== transformBeforeReload) {
  errors.push('[persistence] kp-index position did not survive reload');
} else {
  console.log('persistence ok');
}

// full screen: opens an overlay covering the viewport, exits on click and on Escape
ctxLabel = 'fullscreen';
await page.getByRole('button', { name: 'Full screen Geomagnetic Activity (Kp-index)' }).click();
await page.waitForTimeout(200);
const overlay = page.getByTestId('fullscreen-overlay');
if ((await overlay.count()) !== 1) errors.push('[fullscreen] overlay did not appear');
const overlayBox = await overlay.boundingBox();
const viewport = page.viewportSize();
if (!overlayBox || !viewport || Math.abs(overlayBox.width - viewport.width) > 2 || Math.abs(overlayBox.height - viewport.height) > 2) {
  errors.push(`[fullscreen] overlay does not cover the viewport: ${JSON.stringify(overlayBox)} vs ${JSON.stringify(viewport)}`);
} else {
  console.log('fullscreen overlay covers viewport');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
if ((await page.getByTestId('fullscreen-overlay').count()) !== 0) errors.push('[fullscreen] Escape did not close the overlay');
else console.log('fullscreen Escape-to-close ok');

// reset layout: back to defaults (button lives at the top of the Cards panel)
ctxLabel = 'reset';
await page.locator('#cardsMenuBtn').click();
await page.waitForTimeout(150);
await page.locator('#resetLayoutBtn').click();
await page.waitForTimeout(300);
await page.locator('#cardsMenuBtn').click();
await page.waitForTimeout(200);
const visibleAfterReset = await visibleCardIds(page);
if (visibleAfterReset.length !== DEFAULT_VISIBLE.length || DEFAULT_VISIBLE.some((id) => !visibleAfterReset.includes(id))) {
  errors.push(`[reset] expected default visible set, got ${JSON.stringify(visibleAfterReset)}`);
} else {
  console.log('reset ok:', visibleAfterReset);
}

// general settings popup: opens, edits the label-scale/rotate-speed/density
// settings, and the values survive a reload via their own localStorage key.
ctxLabel = 'global-settings';
{
  const heightBefore = await page.locator('[data-card-id="iss-globe"]').boundingBox();

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
    await popup.locator('#global-setting-density-compact').check();
    await page.waitForTimeout(150);
    // The backdrop covers the whole viewport (including the header button
    // underneath) — close via its own "Close settings" button instead.
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.waitForTimeout(300);

    // rotate speed 0 should actually stop the idle spin (not just clamp to a
    // very slow speed) — reuse the pixel-diff approach from 'auto-rotate'.
    // natural-events, not iss-globe: satellites move every second there, so
    // that globe never looks static even with the spin stopped.
    const globeCanvas = page.locator('[data-card-id="natural-events"] canvas');
    const stoppedDiff = await settledDiff(globeCanvas, 500);
    if (stoppedDiff >= 500) errors.push(`[global-settings] rotate speed 0 did not stop the spin (diff=${stoppedDiff})`);
    else console.log('global-settings: rotate speed 0 stops the spin ok, diff=', stoppedDiff);

    // compact density should visibly shrink the card (shorter row height).
    const heightAfter = await page.locator('[data-card-id="iss-globe"]').boundingBox();
    if (!heightBefore || !heightAfter || heightAfter.height >= heightBefore.height) {
      errors.push(
        `[global-settings] compact density did not shrink card height: ${heightBefore?.height} -> ${heightAfter?.height}`,
      );
    } else {
      console.log('global-settings: compact density shrinks cards ok:', heightBefore.height, '->', heightAfter.height);
    }

    await page.reload();
    await page.waitForSelector('#app');
    await page.waitForTimeout(500);
    await page.locator('#generalSettingsBtn').click();
    await page.waitForTimeout(150);
    const reopenedLabelScale = await page.locator('#global-setting-label-scale').inputValue();
    const reopenedRotateSpeed = await page.locator('#global-setting-rotate-speed').inputValue();
    const reopenedDensityCompact = await page.locator('#global-setting-density-compact').isChecked();
    if (reopenedLabelScale !== '1.6' || reopenedRotateSpeed !== '0' || !reopenedDensityCompact) {
      errors.push(
        `[global-settings] settings did not survive reload: labelScale=${reopenedLabelScale} rotateSpeed=${reopenedRotateSpeed} densityCompact=${reopenedDensityCompact}`,
      );
    } else {
      console.log('global-settings: opens, edits, persists ok');
    }
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.waitForTimeout(150);
  }
}

// per-card "Earth style" select: switching a globe card to the flat map
// must not throw (iss-globe is back after the reset above).
ctxLabel = 'earth-style';
{
  await page.getByRole('button', { name: 'Settings for ISS & Satellites' }).click();
  await page.waitForTimeout(150);
  const mapOption = page.locator('#iss-globe-setting-earthStyle-map');
  if ((await mapOption.count()) !== 1) {
    errors.push('[earth-style] map option not found in settings popup');
  } else {
    await mapOption.check();
    await page.waitForTimeout(300);
    if (!(await mapOption.isChecked())) errors.push('[earth-style] map option did not become checked');
    else console.log('earth-style: switched to flat map ok');
  }
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.waitForTimeout(150);
}

// mobile layout: below the #cardMenu breakpoint, cards stack in a single
// column and stay draggable — reordering persists across reload. Runs on a
// fresh tab/viewport so it doesn't disturb the desktop-sized page above.
ctxLabel = 'mobile-layout';
{
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  attach(mobilePage);
  await mobilePage.goto(BASE);
  await mobilePage.waitForSelector('#app');
  await mobilePage.waitForTimeout(500);

  const readMobileOrder = () =>
    mobilePage.evaluate(() => {
      const raw = window.localStorage.getItem('space-radar:layout:v1');
      return raw ? JSON.parse(raw).mobileOrder : null;
    });

  const order = await readMobileOrder();
  if (!Array.isArray(order) || order.length < 2) {
    errors.push(`[mobile-layout] expected a persisted mobileOrder with 2+ cards, got ${JSON.stringify(order)}`);
  } else {
    const firstBox = await mobilePage.locator(`[data-card-id="${order[0]}"]`).boundingBox();
    const secondBox = await mobilePage.locator(`[data-card-id="${order[1]}"]`).boundingBox();
    if (!firstBox || !secondBox) {
      errors.push('[mobile-layout] could not measure card positions');
    } else if (Math.abs(firstBox.x - secondBox.x) > 4 || secondBox.y <= firstBox.y) {
      errors.push(`[mobile-layout] cards are not stacked in a single column: ${JSON.stringify({ firstBox, secondBox })}`);
    } else {
      console.log('mobile-layout: single column ok:', order);
    }

    // In the single column only the ≡ grip drags (the rest of the header
    // scrolls the page on touch devices).
    const secondHandle = mobilePage.locator(`[data-card-id="${order[1]}"] .card-drag-grip`);
    await secondHandle.scrollIntoViewIfNeeded();
    const handleBox = await secondHandle.boundingBox();
    if (!handleBox) {
      errors.push('[mobile-layout] drag handle not found');
    } else {
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      await mobilePage.mouse.move(startX, startY);
      await mobilePage.mouse.down();
      // Must clear more than half the first card's height (~166px here) to
      // cross react-grid-layout's swap threshold — comfortably overshoot it.
      await mobilePage.mouse.move(startX, startY - 360, { steps: 15 });
      await mobilePage.mouse.up();
      await mobilePage.waitForTimeout(300);

      const reordered = await readMobileOrder();
      if (!Array.isArray(reordered) || reordered[0] !== order[1]) {
        errors.push(`[mobile-layout] drag-to-reorder did not move "${order[1]}" to the top: ${JSON.stringify(reordered)}`);
      } else {
        console.log('mobile-layout: drag-to-reorder ok:', reordered);
      }

      await mobilePage.reload();
      await mobilePage.waitForSelector('#app');
      await mobilePage.waitForTimeout(500);
      const afterReload = await readMobileOrder();
      if (!Array.isArray(afterReload) || afterReload[0] !== order[1]) {
        errors.push('[mobile-layout] reordered mobile layout did not survive reload');
      } else {
        console.log('mobile-layout: order persists across reload ok');
      }
    }
  }
  await mobilePage.close();
}

// touch gestures on a phone: one finger over a 3D card scrolls the page and
// leaves the scene alone; two fingers rotate the scene and don't scroll.
// Playwright's `touchscreen` only taps, so swipes go through CDP
// Input.dispatchTouchEvent (real input pipeline → real native scrolling).
ctxLabel = 'touch-gestures';
{
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await touchContext.newPage();
  attach(touchPage);
  await touchPage.goto(BASE);
  await touchPage.waitForSelector('#app');
  await touchPage.waitForTimeout(800);
  const cdp = await touchContext.newCDPSession(touchPage);

  async function swipe(points, dx, dy) {
    const at = (t) => points.map((p, id) => ({ x: p.x + dx * t, y: p.y + dy * t, id }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / 12) });
      await touchPage.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPage.waitForTimeout(600);
  }
  // The phone layout scrolls the document itself (#viewWrap grows to fit).
  const scrollTop = () => touchPage.evaluate(() => (document.scrollingElement?.scrollTop ?? 0) + (document.querySelector('#viewWrap')?.scrollTop ?? 0));

  const coarse = await touchPage.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
  if (!coarse) errors.push('[touch-gestures] emulated phone does not report (pointer: coarse)');

  // solar-system has no auto-rotate, so any canvas change is the gesture.
  const canvas = touchPage.locator('[data-card-id="solar-system"] canvas');
  await canvas.scrollIntoViewIfNeeded();
  await touchPage.waitForTimeout(500);
  let box = await canvas.boundingBox();
  if (!box) {
    errors.push('[touch-gestures] solar-system canvas not found');
  } else {
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const scrollBefore = await scrollTop();
    const shotBefore = await canvas.screenshot();
    await swipe([center], 0, -150);
    const scrollAfter = await scrollTop();
    const hintShown = await touchPage.locator('[data-card-id="solar-system"] .gesture-hint-visible').count();
    if (hintShown !== 1) errors.push('[touch-gestures] "two fingers" hint was not shown after a one-finger swipe');
    // Let the hint (an overlay over the canvas) fade before the screenshot.
    await touchPage.waitForTimeout(1800);
    const oneFingerDiff = countDiffPixels(shotBefore, await canvas.screenshot());
    if (scrollAfter <= scrollBefore) errors.push(`[touch-gestures] one-finger swipe did not scroll the page (${scrollBefore} -> ${scrollAfter})`);
    if (oneFingerDiff >= 1000) errors.push(`[touch-gestures] one-finger swipe rotated the scene (diff=${oneFingerDiff})`);
    if (scrollAfter > scrollBefore && oneFingerDiff < 1000) console.log('touch: one finger scrolls, scene untouched ok', scrollBefore, '->', scrollAfter, 'diff=', oneFingerDiff);

    box = await canvas.boundingBox();
    const c2 = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const scrollBefore2 = await scrollTop();
    const shotBefore2 = await canvas.screenshot();
    await swipe([{ x: c2.x - 40, y: c2.y }, { x: c2.x + 40, y: c2.y }], 120, 0);
    await touchPage.waitForTimeout(1500);
    const scrollAfter2 = await scrollTop();
    const twoFingerDiff = countDiffPixels(shotBefore2, await canvas.screenshot());
    if (scrollAfter2 !== scrollBefore2) errors.push(`[touch-gestures] two-finger drag scrolled the page (${scrollBefore2} -> ${scrollAfter2})`);
    if (twoFingerDiff < 1000) errors.push(`[touch-gestures] two-finger drag did not rotate the scene (diff=${twoFingerDiff})`);
    if (scrollAfter2 === scrollBefore2 && twoFingerDiff >= 1000) console.log('touch: two fingers rotate, no scroll ok, diff=', twoFingerDiff);

    // one-finger swipe over a card header scrolls instead of dragging the card
    const header = touchPage.locator('[data-card-id="solar-system"] .card-shell-title');
    const hb = await header.boundingBox();
    if (hb) {
      const orderBefore = await touchPage.evaluate(() => localStorage.getItem('space-radar:layout:v1'));
      const s0 = await scrollTop();
      await swipe([{ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }], 0, -120);
      const s1 = await scrollTop();
      const orderAfter = await touchPage.evaluate(() => localStorage.getItem('space-radar:layout:v1'));
      if (s1 === s0) errors.push('[touch-gestures] swipe over a card header did not scroll the page');
      if (orderAfter !== orderBefore) errors.push('[touch-gestures] swipe over a card header moved the card');
      if (s1 !== s0 && orderAfter === orderBefore) console.log('touch: header swipe scrolls, no drag ok');
    }
  }
  await touchContext.close();
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
