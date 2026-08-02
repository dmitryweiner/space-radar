import { Ecliptic, GeoMoon, JupiterMoons, Vector } from 'astronomy-engine';
import type { HeliocentricVector, PlanetName } from './planetPositions';

export interface MoonPosition {
  planet: PlanetName;
  name: string;
  /** Display ordering from the planet outward (0 = innermost). */
  order: number;
  /** Position relative to the parent planet, ecliptic frame, in AU. */
  offsetAu: HeliocentricVector;
}

// astronomy-engine only ships ephemerides for Earth's Moon and Jupiter's four
// Galilean moons — the large, easily-seen ones. Saturn/Uranus/Neptune moons
// aren't available, so they are intentionally omitted rather than faked.
function eclipticOffset(vec: Vector): HeliocentricVector {
  const e = Ecliptic(vec).vec;
  return { xAu: e.x, yAu: e.y, zAu: e.z };
}

export function computeMoonPositions(date: Date): MoonPosition[] {
  const moons: MoonPosition[] = [{ planet: 'Earth', name: 'Moon', order: 0, offsetAu: eclipticOffset(GeoMoon(date)) }];

  const jm = JupiterMoons(date);
  const galileans: { name: string; state: Vector }[] = [
    { name: 'Io', state: new Vector(jm.io.x, jm.io.y, jm.io.z, jm.io.t) },
    { name: 'Europa', state: new Vector(jm.europa.x, jm.europa.y, jm.europa.z, jm.europa.t) },
    { name: 'Ganymede', state: new Vector(jm.ganymede.x, jm.ganymede.y, jm.ganymede.z, jm.ganymede.t) },
    { name: 'Callisto', state: new Vector(jm.callisto.x, jm.callisto.y, jm.callisto.z, jm.callisto.t) },
  ];
  galileans.forEach(({ name, state }, i) => {
    moons.push({ planet: 'Jupiter', name, order: i, offsetAu: eclipticOffset(state) });
  });

  return moons;
}
