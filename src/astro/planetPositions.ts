import { Body, HelioVector } from 'astronomy-engine';

export type PlanetName = 'Mercury' | 'Venus' | 'Earth' | 'Mars' | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune';

export interface PlanetPosition {
  name: PlanetName;
  xAu: number;
  yAu: number;
  zAu: number;
  distanceAu: number;
}

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

export function computePlanetPositions(date: Date): PlanetPosition[] {
  return PLANETS.map((name) => {
    const vector = HelioVector(BODY_BY_NAME[name], date);
    return { name, xAu: vector.x, yAu: vector.y, zAu: vector.z, distanceAu: vector.Length() };
  });
}
