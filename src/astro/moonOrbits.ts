import type { HeliocentricVector, PlanetName } from './planetPositions';

// astronomy-engine has no ephemerides for the moons of Mars or Saturn, so each
// is modelled as a circle in a fixed plane with a linearly advancing angle,
// fitted to JPL Horizons over 2024–2029 by scripts/fitMoonOrbits.mjs (re-run
// it to refresh these). Direction error stays within ~3.5° over 2020–2033
// (Mimas up to ~8°, from its libration in the Mimas–Tethys resonance) — ample
// for display orbits, which keep only the direction anyway.
//
// Plane: `pole` is the mean orbit normal (J2000 ecliptic). Angle: measured in
// that plane from its ascending node on the ecliptic, `l0Deg` at EPOCH_JD.
export interface MeanMoonOrbit {
  name: string;
  planet: PlanetName;
  /** Mean distance from the planet, AU. */
  aAu: number;
  pole: HeliocentricVector;
  l0Deg: number;
  rateDegPerDay: number;
}

const EPOCH_JD = 2461041.5; // 2026-01-01 00:00 TDB (TT−UTC's ~69 s is negligible here)
const UNIX_EPOCH_JD = 2440587.5;
const DAY_MS = 86_400_000;
const DEG = Math.PI / 180;

// Largest moons only: both of Mars's, and Saturn's seven round ones (Hyperion,
// at ~135 km and not round, is left out). Ordered from the planet outward.
export const MEAN_MOON_ORBITS: MeanMoonOrbit[] = [
  { name: 'Phobos', planet: 'Mars', aAu: 0.000062675, pole: { xAu: 0.444882, yAu: -0.057079, zAu: 0.893768 }, l0Deg: 169.602, rateDegPerDay: 1128.84493704 },
  { name: 'Deimos', planet: 'Mars', aAu: 0.0001568, pole: { xAu: 0.404548, yAu: -0.060889, zAu: 0.912487 }, l0Deg: 338.999, rateDegPerDay: 285.161810685 },
  { name: 'Mimas', planet: 'Saturn', aAu: 0.0012405, pole: { xAu: 0.085573, yAu: 0.462765, zAu: 0.882341 }, l0Deg: 328.682, rateDegPerDay: 381.995390533 },
  { name: 'Enceladus', planet: 'Saturn', aAu: 0.0015912, pole: { xAu: 0.085512, yAu: 0.462419, zAu: 0.882528 }, l0Deg: 15.746, rateDegPerDay: 262.731615421 },
  { name: 'Tethys', planet: 'Saturn', aAu: 0.0019698, pole: { xAu: 0.085582, yAu: 0.462417, zAu: 0.882522 }, l0Deg: 313.2, rateDegPerDay: 190.697865283 },
  { name: 'Dione', planet: 'Saturn', aAu: 0.0025229, pole: { xAu: 0.085295, yAu: 0.462139, zAu: 0.882696 }, l0Deg: 58.407, rateDegPerDay: 131.534950671 },
  { name: 'Rhea', planet: 'Saturn', aAu: 0.0035232, pole: { xAu: 0.082393, yAu: 0.466175, zAu: 0.880847 }, l0Deg: 68.337, rateDegPerDay: 79.6900433178 },
  { name: 'Titan', planet: 'Saturn', aAu: 0.0081716, pole: { xAu: 0.088098, yAu: 0.456491, zAu: 0.885356 }, l0Deg: 170.261, rateDegPerDay: 22.5769529605 },
  { name: 'Iapetus', planet: 'Saturn', aAu: 0.023812, pole: { xAu: 0.192233, yAu: 0.219955, zAu: 0.956382 }, l0Deg: 333.204, rateDegPerDay: 4.53782110728 },
];

/** Planet-centred position (J2000 ecliptic, AU) of a mean-orbit moon. */
export function meanMoonOffset(orbit: MeanMoonOrbit, date: Date): HeliocentricVector {
  const p = orbit.pole;
  const len = Math.hypot(p.xAu, p.yAu, p.zAu); // rounded table values: renormalize
  const n = { xAu: p.xAu / len, yAu: p.yAu / len, zAu: p.zAu / len };
  // u = ecliptic north × n (the ascending node), w = n × u.
  const uLen = Math.hypot(n.xAu, n.yAu);
  const u = { x: -n.yAu / uLen, y: n.xAu / uLen, z: 0 };
  const w = { x: n.yAu * u.z - n.zAu * u.y, y: n.zAu * u.x - n.xAu * u.z, z: n.xAu * u.y - n.yAu * u.x };
  const days = date.getTime() / DAY_MS + UNIX_EPOCH_JD - EPOCH_JD;
  const angle = (orbit.l0Deg + orbit.rateDegPerDay * days) * DEG;
  const c = Math.cos(angle) * orbit.aAu;
  const s = Math.sin(angle) * orbit.aAu;
  return { xAu: c * u.x + s * w.x, yAu: c * u.y + s * w.y, zAu: c * u.z + s * w.z };
}
