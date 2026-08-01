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

export interface NaturalEvent {
  id: string;
  title: string;
  category: string;
  time: string | null;
  magnitude: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface FirePoint {
  latitude: number;
  longitude: number;
  brightnessKelvin: number;
  /** 0..1 normalized confidence, or null when the source omits it. */
  confidence: number | null;
  acquiredAt: string;
}

export interface LaunchInfo {
  id: string;
  name: string;
  status: string;
  net: string;
  provider: string | null;
  location: string | null;
}

export interface ApodInfo {
  date: string;
  title: string;
  mediaType: string;
  imageUrl: string | null;
  linkUrl: string | null;
  copyright: string | null;
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
