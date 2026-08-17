#!/usr/bin/env node
// Flexible single debug screenshot. Auto-starts the dev server, optionally
// shows/hides specific cards first, prints any console/page errors.
//
//   node scripts/snap.mjs --out /tmp/x.png
//   node scripts/snap.mjs --out /tmp/x.png --show solar-system --show asteroids --hide kp-index
//   node scripts/snap.mjs --out /tmp/x.png --width 1400 --height 900 --wait 2000
//   node scripts/snap.mjs --out /tmp/x.png --preview   # prod build (vite preview :4173)
//   node scripts/snap.mjs --out /tmp/x.png --click 'button[aria-label="Settings for Solar Wind"]'
//   node scripts/snap.mjs --out /tmp/x.png --click-at '[data-card-id="quakes"] canvas:200,150'  # click at an
//     offset (px) from an element's top-left — for canvas/WebGL content with no clickable DOM node per point
//   node scripts/snap.mjs --out /tmp/x.png --click '#generalSettingsBtn' --key Escape  # runs after
//     --show/--hide, --click, and --click-at, in that order (each flag type is its own phase)

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const MULTI_FLAGS = new Set(['show', 'hide', 'click', 'click-at', 'key']);
const VALUE_FLAGS = new Set(['out', 'width', 'height', 'wait', ...MULTI_FLAGS]);
const flags = new Map();
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const name = a.slice(2);
  if (!VALUE_FLAGS.has(name)) {
    flags.set(name, 'true');
    continue;
  }
  const value = args[++i];
  if (MULTI_FLAGS.has(name)) {
    const list = flags.get(name) ?? [];
    list.push(value);
    flags.set(name, list);
  } else {
    flags.set(name, value);
  }
}

if (!flags.has('out')) {
  console.error(
    'usage: node scripts/snap.mjs --out <path> [--show <cardId>]... [--hide <cardId>]... [--click <selector>]... [--click-at <selector:x,y>]... [--width n] [--height n] [--wait ms] [--preview]',
  );
  process.exit(1);
}

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

const preview = flags.has('preview');
const PORT = preview ? 4173 : 5173;
const BASE = `http://localhost:${PORT}`;
const width = Number(flags.get('width') ?? 1400);
const height = Number(flags.get('height') ?? 900);
const wait = Number(flags.get('wait') ?? 800);

async function serverUp() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

let devProc = null;
async function ensureServer() {
  if (await serverUp()) return;
  const cmd = preview
    ? ['vite', 'preview', '--port', String(PORT), '--strictPort']
    : ['vite', '--port', String(PORT), '--strictPort'];
  devProc = spawn('npx', cmd, { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) {
    console.error(`server did not start on :${PORT}`);
    process.exit(1);
  }
}

const errors = [];
function attach(page) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}

await ensureServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
attach(page);

await page.goto(BASE);
await page.waitForSelector('#app');

const toShow = flags.get('show') ?? [];
const toHide = flags.get('hide') ?? [];
if (toShow.length || toHide.length) {
  await page.locator('#cardsMenuBtn').click();
  await page.waitForTimeout(100);
  for (const id of toShow) {
    const title = CARD_TITLES[id];
    if (!title) {
      console.error(`unknown card id "${id}"`);
      continue;
    }
    const checkbox = page.getByRole('checkbox', { name: title });
    if (!(await checkbox.isChecked())) await checkbox.click();
  }
  for (const id of toHide) {
    const title = CARD_TITLES[id];
    if (!title) {
      console.error(`unknown card id "${id}"`);
      continue;
    }
    const checkbox = page.getByRole('checkbox', { name: title });
    if (await checkbox.isChecked()) await checkbox.click();
  }
  await page.locator('#cardsMenuBtn').click();
}

for (const selector of flags.get('click') ?? []) {
  await page.locator(selector).first().click();
  await page.waitForTimeout(200);
}

for (const spec of flags.get('click-at') ?? []) {
  const lastColon = spec.lastIndexOf(':');
  const selector = spec.slice(0, lastColon);
  const [x, y] = spec.slice(lastColon + 1).split(',').map(Number);
  const box = await page.locator(selector).first().boundingBox();
  if (!box) {
    console.error(`--click-at: element not found for "${selector}"`);
    continue;
  }
  await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(200);
}

for (const key of flags.get('key') ?? []) {
  await page.keyboard.press(key);
  await page.waitForTimeout(200);
}

await page.waitForTimeout(wait);

const outPath = flags.get('out');
mkdirSync(dirname(outPath), { recursive: true });
await page.screenshot({ path: outPath });
console.log(outPath);

console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
devProc?.kill();
process.exit(errors.some((e) => !/Failed to load resource/.test(e)) ? 2 : 0);
