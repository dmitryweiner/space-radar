#!/usr/bin/env node
// One screenshot per card into ./shots — quick visual sweep of every card in
// isolation (each shown alone against the default dark theme).
//
//   node scripts/shot.mjs

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5173;
const BASE = `http://localhost:${PORT}`;

const CARD_TITLES = {
  'iss-globe': 'ISS & Satellites',
  'solar-system': 'Solar System',
  'kp-index': 'Geomagnetic Activity (Kp-index)',
  'solar-wind': 'Solar Wind',
  'aurora-forecast': 'Aurora Forecast',
  'solar-flares': 'Solar Flares & CME',
  asteroids: 'Near-Earth Asteroids',
};
const DEFAULT_VISIBLE = ['iss-globe', 'kp-index', 'solar-wind'];

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
  devProc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 30 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await serverUp())) {
    console.error(`server did not start on :${PORT}`);
    process.exit(1);
  }
}

await ensureServer();
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });

for (const [id, title] of Object.entries(CARD_TITLES)) {
  await page.goto(BASE);
  await page.waitForSelector('#app');
  await page.waitForTimeout(300);

  await page.locator('#cardsMenuBtn').click();
  await page.waitForTimeout(100);
  for (const [otherId, otherTitle] of Object.entries(CARD_TITLES)) {
    const shouldBeVisible = otherId === id;
    const isCurrentlyVisible = DEFAULT_VISIBLE.includes(otherId);
    if (shouldBeVisible !== isCurrentlyVisible) {
      await page.getByRole('checkbox', { name: otherTitle }).click();
    }
  }
  await page.locator('#cardsMenuBtn').click();
  await page.waitForTimeout(1500);

  const path = `shots/${id}.png`;
  await page.screenshot({ path });
  console.log(path);
}

await browser.close();
devProc?.kill();
