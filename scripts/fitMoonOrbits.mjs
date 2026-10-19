#!/usr/bin/env node
// Fits the circular "mean orbit" constants in src/astro/moonOrbits.ts against
// JPL Horizons. astronomy-engine has no ephemerides for the moons of Mars and
// Saturn, so the app uses a fixed orbit plane + linear mean longitude per moon;
// this script derives those numbers from Horizons planet-centred vectors
// (J2000 ecliptic, AU) and prints them as a TS table, plus the worst angular
// error of the fit over the span and a few years either side.
//
//   node scripts/fitMoonOrbits.mjs [--start 2024-01-01] [--stop 2029-01-01]
//
// Re-run and paste the output if the constants ever need refreshing.

const MOONS = [
  { name: 'Phobos', id: '401', planet: 'Mars', center: '499', step: '30m' },
  { name: 'Deimos', id: '402', planet: 'Mars', center: '499', step: '2h' },
  { name: 'Mimas', id: '601', planet: 'Saturn', center: '699', step: '2h' },
  { name: 'Enceladus', id: '602', planet: 'Saturn', center: '699', step: '3h' },
  { name: 'Tethys', id: '603', planet: 'Saturn', center: '699', step: '4h' },
  { name: 'Dione', id: '604', planet: 'Saturn', center: '699', step: '6h' },
  { name: 'Rhea', id: '605', planet: 'Saturn', center: '699', step: '8h' },
  { name: 'Titan', id: '606', planet: 'Saturn', center: '699', step: '1d' },
  { name: 'Iapetus', id: '608', planet: 'Saturn', center: '699', step: '2d' },
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const START = arg('start', '2024-01-01');
const STOP = arg('stop', '2029-01-01');
const EPOCH_JD = 2461041.5; // 2026-01-01 00:00 TDB

async function vectors(id, center, start, stop, step) {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${id}'`,
    CENTER: `'500@${center}'`,
    EPHEM_TYPE: "'VECTORS'",
    REF_PLANE: "'ECLIPTIC'",
    REF_SYSTEM: "'J2000'",
    VEC_TABLE: "'1'",
    OUT_UNITS: "'AU-D'",
    CSV_FORMAT: "'YES'",
    OBJ_DATA: "'NO'",
    START_TIME: `'${start}'`,
    STOP_TIME: `'${stop}'`,
    STEP_SIZE: `'${step}'`,
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
    if (res.ok) {
      const text = await res.text();
      const body = text.split('$$SOE')[1]?.split('$$EOE')[0];
      if (!body) throw new Error(`No ephemeris for ${id}: ${text.slice(0, 400)}`);
      return body
        .trim()
        .split('\n')
        .map((line) => {
          const cells = line.split(',').map((c) => c.trim());
          return { jd: Number(cells[0]), r: [Number(cells[2]), Number(cells[3]), Number(cells[4])] };
        });
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  throw new Error(`Horizons kept failing for ${id}`);
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => a.map((x) => x / norm(a));

function fit(samples) {
  // Mean orbit plane: average angular-momentum direction of consecutive samples.
  let h = [0, 0, 0];
  for (let i = 1; i < samples.length; i += 1) {
    const c = unit(cross(samples[i - 1].r, samples[i].r));
    h = [h[0] + c[0], h[1] + c[1], h[2] + c[2]];
  }
  const n = unit(h);
  // Reference direction: the plane's ascending node on the ecliptic.
  const u = unit(cross([0, 0, 1], n));
  const w = cross(n, u);
  let prev = null;
  let turns = 0;
  const pts = samples.map(({ jd, r }) => {
    let a = Math.atan2(dot(r, w), dot(r, u));
    if (prev !== null) {
      if (a - prev < -Math.PI) turns += 1;
      if (a - prev > Math.PI) turns -= 1;
    }
    prev = a;
    return { t: jd - EPOCH_JD, a: a + turns * 2 * Math.PI, r: norm(r) };
  });
  // Least-squares line angle(t) = l0 + rate·t.
  const m = pts.length;
  const st = pts.reduce((s, p) => s + p.t, 0);
  const sa = pts.reduce((s, p) => s + p.a, 0);
  const stt = pts.reduce((s, p) => s + p.t * p.t, 0);
  const sta = pts.reduce((s, p) => s + p.t * p.a, 0);
  const rate = (m * sta - st * sa) / (m * stt - st * st);
  const l0 = (sa - rate * st) / m;
  const a = pts.reduce((s, p) => s + p.r, 0) / m;
  return { n, l0, rate, a };
}

function maxError(samples, model) {
  const { n, l0, rate } = model;
  const u = unit(cross([0, 0, 1], n));
  const w = cross(n, u);
  let worst = 0;
  for (const { jd, r } of samples) {
    const ang = l0 + rate * (jd - EPOCH_JD);
    const p = [0, 1, 2].map((k) => Math.cos(ang) * u[k] + Math.sin(ang) * w[k]);
    worst = Math.max(worst, Math.acos(Math.min(1, dot(p, unit(r)))));
  }
  return (worst * 180) / Math.PI;
}

const DEG = 180 / Math.PI;
const fmt = (x, d) => Number(x.toFixed(d));
const lines = [];
for (const moon of MOONS) {
  const samples = await vectors(moon.id, moon.center, START, STOP, moon.step);
  const model = fit(samples);
  // Check outside the fit window too (coarser steps are fine for this).
  const check = await vectors(moon.id, moon.center, '2020-01-01', '2033-01-01', '5d');
  const l0 = (((model.l0 * DEG) % 360) + 360) % 360;
  const row = {
    name: moon.name,
    planet: moon.planet,
    aAu: Number(model.a.toPrecision(5)),
    pole: model.n.map((x) => fmt(x, 6)),
    l0Deg: fmt(l0, 3),
    rateDegPerDay: Number((model.rate * DEG).toPrecision(12)),
  };
  console.error(
    `${moon.name}: ${samples.length} samples, max error ${maxError(samples, model).toFixed(1)}° in fit, ` +
      `${maxError(check, model).toFixed(1)}° over 2020–2033`,
  );
  lines.push(
    `  { name: '${row.name}', planet: '${row.planet}', aAu: ${row.aAu}, pole: { xAu: ${row.pole[0]}, yAu: ${row.pole[1]}, zAu: ${row.pole[2]} }, l0Deg: ${row.l0Deg}, rateDegPerDay: ${row.rateDegPerDay} },`,
  );
}
console.log(lines.join('\n'));
