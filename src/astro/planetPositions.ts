import { Body, Ecliptic, HelioVector, PlanetOrbitalPeriod } from 'astronomy-engine';

export type PlanetName = 'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';

export interface HeliocentricVector {
  xAu: number;
  yAu: number;
  zAu: number;
}

export interface PlanetPosition extends HeliocentricVector {
  name: PlanetName;
  distanceAu: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ORBIT_SAMPLE_COUNT = 64;

const PLANETS: PlanetName[] = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

const BODY_BY_NAME: Record<PlanetName, Body> = {
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Earth: Body.Earth,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
};

// Heliocentric vectors from astronomy-engine are in the EQJ frame (Earth's
// equator), which tilts every orbit by Earth's ~23.4° axial tilt and makes
// them all look coplanar-ish relative to each other. Converting to the
// ecliptic frame (Earth's actual orbital plane) makes Earth's orbit flat by
// definition and shows every other planet's real, small relative
// inclination — the shape people actually expect from a solar system
// diagram.
function eclipticVector(body: Body, date: Date): HeliocentricVector {
  const vec = Ecliptic(HelioVector(body, date)).vec;
  return { xAu: vec.x, yAu: vec.y, zAu: vec.z };
}

export function computePlanetPositions(date: Date): PlanetPosition[] {
  return PLANETS.map((name) => {
    const vector = eclipticVector(BODY_BY_NAME[name], date);
    const distanceAu = Math.hypot(vector.xAu, vector.yAu, vector.zAu);
    return { name, ...vector, distanceAu };
  });
}

export function computePlanetOrbitPath(
  name: PlanetName,
  date: Date,
  sampleCount: number = DEFAULT_ORBIT_SAMPLE_COUNT,
): HeliocentricVector[] {
  const body = BODY_BY_NAME[name];
  const periodDays = PlanetOrbitalPeriod(body);
  const points: HeliocentricVector[] = [];
  for (let i = 0; i <= sampleCount; i += 1) {
    const sampleTime = new Date(date.getTime() + (i / sampleCount) * periodDays * MS_PER_DAY);
    points.push(eclipticVector(body, sampleTime));
  }
  return points;
}
