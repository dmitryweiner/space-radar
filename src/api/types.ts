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

export interface SolarCyclePoint {
  /** Month, "YYYY-MM". */
  time: string;
  /** Observed monthly sunspot number, or null when unreported. */
  ssn: number | null;
  /** 13-month smoothed sunspot number, or null (recent months lack it). */
  smoothedSsn: number | null;
  /** F10.7 cm radio flux, or null. */
  f107: number | null;
}

export interface SolarCyclePrediction {
  time: string;
  predictedSsn: number | null;
  predictedF107: number | null;
}

export interface SolarCycleData {
  observed: SolarCyclePoint[];
  predicted: SolarCyclePrediction[];
}

export interface AuroraSample {
  latitude: number;
  /** Longitude in degrees (OVATION reports 0..360). */
  longitude: number;
  /** Aurora probability, 0..1. */
  probability: number;
}

export interface NaturalEvent {
  id: string;
  title: string;
  category: string;
  time: string | null;
  magnitude: string | null;
  latitude: number | null;
  longitude: number | null;
  /** First source's URL (e.g. the InciWeb/IRWIN incident page) — a
   * human-readable detail page, unlike EONET's own `link` (a JSON endpoint).
   * Null when the event lists no sources. */
  sourceUrl: string | null;
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
  /** Human-readable detail page (spacelaunchnow.me, built from the Launch
   * Library `slug`), or null if the API omitted a slug. */
  detailUrl: string | null;
}

export interface ApodInfo {
  date: string;
  title: string;
  mediaType: string;
  imageUrl: string | null;
  linkUrl: string | null;
  copyright: string | null;
}

export interface Quake {
  id: string;
  magnitude: number;
  place: string;
  /** Origin time, epoch milliseconds. */
  time: number;
  latitude: number;
  longitude: number;
  depthKm: number;
  url: string;
}

export interface EpicFrame {
  /** DSCOVR/EPIC image identifier, e.g. "epic_1b_20260731002712". */
  image: string;
  /** Capture time as reported by the API, e.g. "2026-07-31 00:22:24". */
  date: string;
  /** Full-resolution JPG URL built from the image id and date. */
  imageUrl: string;
  centroidLat: number | null;
  centroidLon: number | null;
}

export interface NasaImage {
  /** NASA library id (nasa_id). */
  id: string;
  title: string;
  description: string | null;
  dateCreated: string | null;
  imageUrl: string;
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
  /** JPL Small-Body Database lookup page (NeoWs' `nasa_jpl_url`), or null if
   * the API omitted it. */
  jplUrl: string | null;
}
