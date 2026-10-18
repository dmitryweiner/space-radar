#!/usr/bin/env node
// Flexible single debug screenshot. Auto-starts the dev server, optionally
// switches the scene tab / clicks things first, prints any console/page errors.
//
//   node scripts/snap.mjs --out /tmp/x.png
//   node scripts/snap.mjs --out /tmp/x.png --tab 'Solar System'   # Earth | Sun | Solar System
//   node scripts/snap.mjs --out /tmp/x.png --width 1400 --height 900 --wait 2000
//   node scripts/snap.mjs --out /tmp/x.png --preview   # prod build (vite preview :4173)
//   node scripts/snap.mjs --out /tmp/x.png --click 'button[aria-label^="Kp"]'
//   node scripts/snap.mjs --out /tmp/x.png --click-at '[data-testid="scene-canvas"]:200,150'  # click at an
//     offset (px) from an element's top-left — for canvas/WebGL content with no clickable DOM node per point
//   node scripts/snap.mjs --out /tmp/x.png --click '#generalSettingsBtn' --key Escape  # runs after
//     --tab, --click, and --click-at, in that order (each flag type is its own phase)
//   node scripts/snap.mjs --out /tmp/x.png --storage 'space-radar:global-settings:v1={"labelScale":2,"rotateSpeed":0}'  # seed a
//     localStorage key (value is raw JSON text) before the app boots; repeatable

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright';
import { ensureServer } from './devServer.mjs';

const args = process.argv.slice(2);
const MULTI_FLAGS = new Set(['click', 'click-at', 'key', 'storage']);
const VALUE_FLAGS = new Set(['out', 'width', 'height', 'wait', 'tab', ...MULTI_FLAGS]);
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
    'usage: node scripts/snap.mjs --out <path> [--tab <name>] [--click <selector>]... [--click-at <selector:x,y>]... [--width n] [--height n] [--wait ms] [--preview]',
  );
  process.exit(1);
}

const preview = flags.has('preview');
const width = Number(flags.get('width') ?? 1400);
const height = Number(flags.get('height') ?? 900);
const wait = Number(flags.get('wait') ?? 800);


const errors = [];
function attach(page) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
}

const { base: BASE, stop: stopServer } = await ensureServer({ preview });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height } });
attach(page);

const seeds = (flags.get('storage') ?? []).map((spec) => {
  const eq = spec.indexOf('=');
  return [spec.slice(0, eq), spec.slice(eq + 1)];
});
if (seeds.length) {
  // Only on the first load, so the app's own writes aren't clobbered by a reload.
  await page.addInitScript((pairs) => {
    if (sessionStorage.getItem('snap-seeded')) return;
    sessionStorage.setItem('snap-seeded', '1');
    for (const [key, value] of pairs) localStorage.setItem(key, value);
  }, seeds);
}

await page.goto(BASE);
await page.waitForSelector('#app');

const tab = flags.get('tab');
if (tab) {
  await page.getByRole('tab', { name: tab }).click();
  await page.waitForTimeout(300);
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
stopServer();
process.exit(errors.some((e) => !/Failed to load resource/.test(e)) ? 2 : 0);
