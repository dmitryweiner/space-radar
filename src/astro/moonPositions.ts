import { Ecliptic, GeoMoon, JupiterMoons, Vector } from 'astronomy-engine';
import { MEAN_MOON_ORBITS, meanMoonOffset } from './moonOrbits';
import type { HeliocentricVector, PlanetName } from './planetPositions';

export interface MoonPosition {
  planet: PlanetName;
  name: string;
  /** Display ordering from the planet outward (0 = innermost). */
  order: number;
  /** Position relative to the parent planet, ecliptic frame, in AU. */
  offsetAu: HeliocentricVector;
  /** Orbit-plane normal (ecliptic frame) to draw the display orbit in; absent
   * = flattened into the ecliptic. */
  orbitPole?: HeliocentricVector;
}

// astronomy-engine only ships ephemerides for Earth's Moon and Jupiter's four
// Galilean moons. Mars's two moons and Saturn's seven largest come from
// fitted mean orbits (moonOrbits.ts); Uranus/Neptune moons are omitted.
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

  const order: Partial<Record<PlanetName, number>> = {};
  for (const orbit of MEAN_MOON_ORBITS) {
    const index = order[orbit.planet] ?? 0;
    order[orbit.planet] = index + 1;
    moons.push({ planet: orbit.planet, name: orbit.name, order: index, offsetAu: meanMoonOffset(orbit, date), orbitPole: orbit.pole });
  }

  return moons;
}
