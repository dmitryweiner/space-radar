export interface TleRecord {
  name: string;
  line1: string;
  line2: string;
}

export interface KpIndexPoint {
  time: string;
  kp: number;
}

export interface SolarWindPoint {
  time: string;
  density: number | null;
  speed: number | null;
  temperature: number | null;
}

export type SpaceWeatherEventKind = 'flare' | 'cme';

export interface SpaceWeatherEvent {
  kind: SpaceWeatherEventKind;
  id: string;
  time: string;
  classType: string | null;
  sourceLocation: string | null;
}

export interface Asteroid {
  id: string;
  name: string;
  hazardous: boolean;
  diameterMinKm: number;
  diameterMaxKm: number;
  closeApproachDate: string;
  missDistanceKm: number;
  relativeVelocityKmH: number;
}
