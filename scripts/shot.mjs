#!/usr/bin/env node
// One screenshot per card into ./shots — quick visual sweep of every card in
// isolation (each shown alone against the default dark theme).
//
//   node scripts/shot.mjs

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { ensureServer } from './devServer.mjs';


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
};
const DEFAULT_VISIBLE = ['iss-globe', 'kp-index', 'solar-wind'];


const { base: BASE, stop: stopServer } = await ensureServer({});
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
stopServer();
