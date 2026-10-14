import type { SceneVector3 } from './coords';

// Schematic ("level A") asteroid flybys: only the close-approach numbers are
// known (time, miss distance, relative speed), not the real geometry, so each
// pass is drawn as a straight line that misses Earth by exactly the miss
// distance, in a direction that is arbitrary but stable per object id. The
// UI says so ("schematic, not the real trajectory"). Pure math — no
// Three.js/React (src/astro rule).

export const EARTH_RADIUS_KM = 6371;
export const MOON_DISTANCE_KM = 384400;
const AU_KM = 149_597_870.7;

export interface FlybyApproach {
  id: string;
  closeApproachMs: number;
  missDistanceKm: number;
  speedKmS: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// FNV-1a → two independent uniforms in [0, 1).
function hashUnits(id: string): [number, number, number] {
  let h = 0x811c9dc5;
  const out: number[] = [];
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < id.length; i += 1) {
      h ^= id.charCodeAt(i) + round * 131;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out.push(h / 0x100000000);
  }
  return [out[0], out[1], out[2]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Closest-approach direction `n` and travel direction `u` (unit, ⟂ n). */
export function flybyAxes(id: string): { n: Vec3; u: Vec3 } {
  const [a, b, c] = hashUnits(id);
  // Uniform point on the sphere for n.
  const z = 2 * a - 1;
  const r = Math.sqrt(1 - z * z);
  const phi = 2 * Math.PI * b;
  const n = { x: r * Math.cos(phi), y: z, z: r * Math.sin(phi) };
  // Any vector not parallel to n gives a basis of the plane ⟂ n.
  const helper = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const e1 = normalize(cross(n, helper));
  const e2 = cross(n, e1);
  const psi = 2 * Math.PI * c;
  const u = { x: e1.x * Math.cos(psi) + e2.x * Math.sin(psi), y: e1.y * Math.cos(psi) + e2.y * Math.sin(psi), z: e1.z * Math.cos(psi) + e2.z * Math.sin(psi) };
  return { n, u };
}

/** Geocentric offset (km) of the object at time `tMs` on its straight line. */
export function flybyOffsetKm(approach: FlybyApproach, tMs: number): Vec3 {
  const { n, u } = flybyAxes(approach.id);
  const along = approach.speedKmS * ((tMs - approach.closeApproachMs) / 1000);
  const d = approach.missDistanceKm;
  return { x: n.x * d + u.x * along, y: n.y * d + u.y * along, z: n.z * d + u.z * along };
}

// Distances span 1 Earth radius to ~0.2 AU — linear, the Moon alone would sit
// 60 Earth radii out and everything else off-screen. Log-compress so 1 R⊕
// maps to the globe surface and FAR_KM to FAR_UNITS.
const FAR_KM = 0.2 * AU_KM;
const FAR_UNITS = 14;

export function compressDistance(km: number, earthRadiusUnits: number): number {
  const clamped = Math.max(EARTH_RADIUS_KM, km);
  const t = Math.log(clamped / EARTH_RADIUS_KM) / Math.log(FAR_KM / EARTH_RADIUS_KM);
  return earthRadiusUnits + (FAR_UNITS - earthRadiusUnits) * t;
}

/** A geocentric km vector → scene units, direction kept, radius compressed. */
export function compressedSceneVector(km: Vec3, earthRadiusUnits: number): SceneVector3 {
  const distance = Math.hypot(km.x, km.y, km.z);
  if (distance === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const scale = compressDistance(distance, earthRadiusUnits) / distance;
  return { x: km.x * scale, y: km.y * scale, z: km.z * scale };
}

export function lunarDistances(km: number): number {
  return km / MOON_DISTANCE_KM;
}
