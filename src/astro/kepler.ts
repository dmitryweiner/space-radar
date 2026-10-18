import type { HeliocentricVector } from './planetPositions';

// Two-body heliocentric orbits from classical elements — enough for asteroids
// and comets (NeoWs / JPL SBDB elements) on a Solar-System-sized view. Handles
// ellipses, hyperbolas (many new comets have e slightly > 1) and the exact
// parabola. All angles in degrees, distances in AU, times as Julian Dates;
// positions come out in the J2000 ecliptic frame like planetPositions.

/** Perihelion-based elements: valid for any eccentricity. */
export interface OrbitalElements {
  /** Perihelion distance, AU. */
  q: number;
  e: number;
  /** Inclination to the ecliptic, deg. */
  i: number;
  /** Longitude of the ascending node, deg. */
  node: number;
  /** Argument of perihelion, deg. */
  peri: number;
  /** Time of perihelion passage, Julian Date. */
  tpJd: number;
}

// Gaussian gravitational constant: mean motion (rad/day) of a 1 AU orbit.
const K = 0.01720209895;
const DEG = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const JD_UNIX_EPOCH = 2440587.5;
// |e − 1| below this is treated as an exact parabola.
const PARABOLIC_TOLERANCE = 1e-8;

export function msToJd(ms: number): number {
  return ms / MS_PER_DAY + JD_UNIX_EPOCH;
}

export function jdToMs(jd: number): number {
  return (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
}

/** Elements from the semi-major-axis form NeoWs uses (mean anomaly at epoch). */
export function fromMeanAnomaly(el: {
  a: number;
  e: number;
  i: number;
  node: number;
  peri: number;
  meanAnomaly: number;
  epochJd: number;
}): OrbitalElements {
  const n = K / Math.abs(el.a) ** 1.5;
  return {
    q: el.a * (1 - el.e),
    e: el.e,
    i: el.i,
    node: el.node,
    peri: el.peri,
    tpJd: el.epochJd - (el.meanAnomaly * DEG) / n,
  };
}

/** Orbital period in days, or null for an open (e ≥ 1) orbit. */
export function orbitalPeriodDays(el: OrbitalElements): number | null {
  if (el.e >= 1) {
    return null;
  }
  const a = el.q / (1 - el.e);
  return (2 * Math.PI) / (K / a ** 1.5);
}

function solveElliptic(meanAnomaly: number, e: number): number {
  const M = Math.atan2(Math.sin(meanAnomaly), Math.cos(meanAnomaly));
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let k = 0; k < 60; k += 1) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-13) break;
  }
  return E;
}

function solveHyperbolic(M: number, e: number): number {
  // Small |M| near e≈1 behaves like a cubic; large |M| like e·sinh(H).
  let H = Math.abs(M) < 1 ? Math.cbrt(6 * M) : Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1.8);
  for (let k = 0; k < 100; k += 1) {
    const dH = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
    H -= dH;
    if (Math.abs(dH) < 1e-13 * Math.max(1, Math.abs(H))) break;
  }
  return H;
}

/** Distance and true anomaly (rad) at a Julian Date. */
function polarAt(el: OrbitalElements, jd: number): { r: number; nu: number } {
  const dt = jd - el.tpJd;
  const { q, e } = el;
  if (Math.abs(e - 1) < PARABOLIC_TOLERANCE) {
    // Barker's equation: s + s³/3 = W, s = tan(ν/2).
    const W = (K * dt) / Math.sqrt(2 * q ** 3);
    const Y = Math.cbrt(1.5 * W + Math.sqrt(2.25 * W * W + 1));
    const s = Y - 1 / Y;
    return { r: q * (1 + s * s), nu: 2 * Math.atan(s) };
  }
  if (e < 1) {
    const a = q / (1 - e);
    const E = solveElliptic((K / a ** 1.5) * dt, e);
    return {
      r: a * (1 - e * Math.cos(E)),
      nu: Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e),
    };
  }
  const a = q / (e - 1);
  const H = solveHyperbolic((K / a ** 1.5) * dt, e);
  return {
    r: a * (e * Math.cosh(H) - 1),
    nu: 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2)),
  };
}

function toEcliptic(el: OrbitalElements, r: number, nu: number): HeliocentricVector {
  const node = el.node * DEG;
  const inc = el.i * DEG;
  const u = el.peri * DEG + nu;
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  return {
    xAu: r * (Math.cos(node) * cosU - Math.sin(node) * sinU * Math.cos(inc)),
    yAu: r * (Math.sin(node) * cosU + Math.cos(node) * sinU * Math.cos(inc)),
    zAu: r * sinU * Math.sin(inc),
  };
}

/** Heliocentric ecliptic position at a Julian Date. */
export function orbitPosition(el: OrbitalElements, jd: number): HeliocentricVector {
  const { r, nu } = polarAt(el, jd);
  return toEcliptic(el, r, nu);
}

/**
 * Points along the orbit for drawing. A closed ellipse whose aphelion is within
 * `maxRadiusAu` comes back as a full loop (`closed: true`); anything bigger or
 * open is the arc where r ≤ maxRadiusAu, perihelion in the middle.
 */
export function orbitPath(
  el: OrbitalElements,
  samples = 128,
  maxRadiusAu = 40,
): { points: HeliocentricVector[]; closed: boolean } {
  const { q, e } = el;
  const p = q * (1 + e);
  const aphelion = e < 1 ? p / (1 - e) : Infinity;
  let nuMax = Math.PI;
  let closed = true;
  if (aphelion > maxRadiusAu) {
    closed = false;
    // r(ν) = p / (1 + e·cos ν) reaches maxRadiusAu at ν = ±acos((p/r − 1)/e).
    nuMax = e === 0 ? Math.PI : Math.acos(Math.max(-1, Math.min(1, (p / maxRadiusAu - 1) / e)));
  }
  const points: HeliocentricVector[] = [];
  const count = closed ? samples : samples + 1;
  for (let k = 0; k < count; k += 1) {
    // Closed: uniform in eccentric anomaly (even spacing along an ellipse).
    // Open: uniform in true anomaly between ±nuMax.
    let nu: number;
    if (closed) {
      const E = -Math.PI + (2 * Math.PI * k) / samples;
      nu = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(E), Math.cos(E) - e);
    } else {
      nu = -nuMax + (2 * nuMax * k) / samples;
    }
    points.push(toEcliptic(el, p / (1 + e * Math.cos(nu)), nu));
  }
  return { points, closed };
}

// Beyond this the Solar System view compresses distance logarithmically so the
// Voyagers (~130–175 AU) fit beside Neptune's orbit (30 AU), which stays exact.
export const DISPLAY_LINEAR_LIMIT_AU = 35;
const DISPLAY_LOG_SCALE_AU = 10;

/** Display radius for a true heliocentric distance (identity up to 35 AU). */
export function displayRadiusAu(r: number): number {
  if (r <= DISPLAY_LINEAR_LIMIT_AU) {
    return r;
  }
  return DISPLAY_LINEAR_LIMIT_AU + DISPLAY_LOG_SCALE_AU * Math.log(1 + (r - DISPLAY_LINEAR_LIMIT_AU) / DISPLAY_LOG_SCALE_AU);
}

/** The vector with its length run through displayRadiusAu. */
export function compressForDisplay(v: HeliocentricVector): HeliocentricVector {
  const r = Math.hypot(v.xAu, v.yAu, v.zAu);
  if (r <= DISPLAY_LINEAR_LIMIT_AU) {
    return v;
  }
  const s = displayRadiusAu(r) / r;
  return { xAu: v.xAu * s, yAu: v.yAu * s, zAu: v.zAu * s };
}

export function distanceAu(a: HeliocentricVector, b: HeliocentricVector): number {
  return Math.hypot(a.xAu - b.xAu, a.yAu - b.yAu, a.zAu - b.zAu);
}
