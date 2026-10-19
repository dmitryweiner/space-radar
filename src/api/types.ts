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

/** One sunspot/active region from SWPC's daily region report (its latest day). */
export interface SolarRegion {
  /** NOAA region number, e.g. 4557. */
  region: number;
  /** Report date, "YYYY-MM-DD"; positions are for 00:00 UTC that day. */
  observedDate: string;
  latDeg: number;
  /** Stonyhurst longitude, west of the central meridian positive. */
  lonDeg: number;
  /** Area in millionths of the visible hemisphere; null = plage only (no spots). */
  area: number | null;
  /** McIntosh class, e.g. "Eki". */
  spotClass: string | null;
  /** Mount Wilson magnetic class, e.g. "BG". */
  magClass: string | null;
  spots: number | null;
  /** X-ray flares (C/M/X) from this region that day. */
  flares: { c: number; m: number; x: number };
  /** SWPC's 24 h flare probabilities, percent. */
  probability: { c: number; m: number; x: number } | null;
}

/** A GOES X-ray flare from SWPC's edited event list, tied to its region. */
export interface SolarFlare {
  id: string;
  begin: string;
  peak: string | null;
  end: string | null;
  /** GOES class, e.g. "M1.4". */
  classType: string;
  region: number | null;
  /** Optical flare location ("S20W35") when an observatory reported one. */
  location: string | null;
}

/** One sample of GOES 1–8 Å X-ray flux (W/m²). */
export interface XrayFluxPoint {
  time: string;
  flux: number;
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
  /** Close-approach instant (ms, `epoch_date_close_approach`). */
  closeApproachMs?: number;
  /** Only with `detailed=true`: JPL orbit uncertainty 0 (good) … 9 (poor). */
  orbitUncertainty?: number | null;
  /** Only with `detailed=true`: e.g. "Apollo", "Aten". */
  orbitClass?: string | null;
  /** Only with `detailed=true`: heliocentric ecliptic J2000 elements. */
  elements?: AsteroidElements | null;
}

/** NeoWs `orbital_data` elements (angles in degrees, epoch as a Julian Date). */
export interface AsteroidElements {
  a: number;
  e: number;
  i: number;
  node: number;
  peri: number;
  meanAnomaly: number;
  epochJd: number;
}

/** One heliocentric ecliptic J2000 position (AU) at an instant. */
export interface TrackSample {
  ms: number;
  xAu: number;
  yAu: number;
  zAu: number;
}

/** A spacecraft's positions from JPL Horizons, ordered by time. */
export interface SpacecraftTrack {
  /** Horizons id, e.g. "-31". */
  id: string;
  samples: TrackSample[];
}

/** A comet from the JPL Small-Body Database (perihelion-form elements). */
export interface Comet {
  /** Primary designation, e.g. "1P" or "2025 E1". */
  id: string;
  name: string;
  q: number;
  e: number;
  i: number;
  node: number;
  peri: number;
  tpJd: number;
  /** Comet total absolute magnitude M1 (smaller = brighter), if known. */
  magnitude: number | null;
}

/** NOAA space-weather scales, 0 (none) … 5 (extreme). */
export interface NoaaScales {
  /** Radio blackouts (X-ray flares). */
  r: number;
  /** Solar radiation storms (protons). */
  s: number;
  /** Geomagnetic storms. */
  g: number;
  /** "YYYY-MM-DD HH:MM:SS" UTC of the observation. */
  observedAt: string;
}

export interface PeopleInSpace {
  count: number;
  people: { name: string; agency: string | null }[];
}

/** A bolide reported to JPL's fireball database (US government sensors). */
export interface Fireball {
  /** "YYYY-MM-DD HH:MM:SS" UTC. */
  date: string;
  latitude: number;
  longitude: number;
  /** Estimated total impact energy, kilotons TNT. */
  impactEnergyKt: number;
  altitudeKm: number | null;
  velocityKmS: number | null;
}
