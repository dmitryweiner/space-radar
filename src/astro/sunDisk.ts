import { Body, GeoVector, MakeTime, SunPosition } from 'astronomy-engine';

// Where a point on the Sun's surface appears on a north-up, west-right
// full-disk image as seen from Earth (SDO's latest images are rotated to solar
// north up). Pure math — no Three.js/React (src/astro rule).
//
// Coordinates are Stonyhurst heliographic: latitude, and longitude measured
// from the central meridian as seen from Earth, **west positive**. (NOAA SWPC's
// JSON uses the opposite sign — east positive — so convert at the parser.)

const DEG = Math.PI / 180;

/** The Sun's angular radius at 1 AU, arcseconds (IAU nominal). */
const SOLAR_RADIUS_ARCSEC_AT_1AU = 959.63;

/** Inclination of the solar equator to the ecliptic (Carrington). */
const SOLAR_EQUATOR_INCLINATION = 7.25;

export interface HeliographicPoint {
  latDeg: number;
  /** Stonyhurst longitude, west of the central meridian positive. */
  lonDeg: number;
}

export interface DiskPoint {
  /** West (right) of disk centre, in solar radii. */
  x: number;
  /** North (up) of disk centre, in solar radii. */
  y: number;
  /** On the Earth-facing hemisphere. */
  visible: boolean;
}

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/**
 * B0: heliographic latitude of the disk centre — how far the solar north pole
 * is tipped toward Earth (±7.25°, +max early September). Meeus ch. 29.
 */
export function solarB0Deg(date: Date): number {
  const jd = julianDay(date);
  const k = 73.6667 + (1.3958333 * (jd - 2396758)) / 36525;
  const lambda = SunPosition(MakeTime(date)).elon;
  return Math.asin(Math.sin((lambda - k) * DEG) * Math.sin(SOLAR_EQUATOR_INCLINATION * DEG)) / DEG;
}

/** The Sun's apparent radius from Earth in arcseconds (~944″ July – ~976″ January). */
export function solarAngularRadiusArcsec(date: Date): number {
  return SOLAR_RADIUS_ARCSEC_AT_1AU / GeoVector(Body.Sun, MakeTime(date), true).Length();
}

/** Orthographic projection of a surface point onto the disk seen from Earth. */
export function projectToDisk(point: HeliographicPoint, b0Deg: number): DiskPoint {
  const lat = point.latDeg * DEG;
  const lon = point.lonDeg * DEG;
  const b0 = b0Deg * DEG;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat) * Math.cos(b0) - Math.cos(lat) * Math.cos(lon) * Math.sin(b0);
  const z = Math.sin(lat) * Math.sin(b0) + Math.cos(lat) * Math.cos(lon) * Math.cos(b0);
  return { x, y, visible: z > 0 };
}

/**
 * Synodic rotation rate (deg/day) at a latitude, as seen from Earth: the
 * Snodgrass sidereal profile minus Earth's orbital motion. The equator turns
 * ~13.2°/day, the poles much slower.
 */
export function synodicRotationDegPerDay(latDeg: number): number {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  return 14.713 - 2.396 * s2 - 1.787 * s2 * s2 - 0.9856;
}

/** Carry a feature observed at `fromMs` forward (or back) to `toMs` by differential rotation. */
export function rotateToTime(point: HeliographicPoint, fromMs: number, toMs: number): HeliographicPoint {
  const days = (toMs - fromMs) / 86_400_000;
  return { latDeg: point.latDeg, lonDeg: point.lonDeg + synodicRotationDegPerDay(point.latDeg) * days };
}

const LOCATION_PATTERN = /^([NS])(\d{1,2})([EW])(\d{1,3})$/;

/** "N06W28" → { latDeg: 6, lonDeg: 28 } (Stonyhurst, west positive); null if malformed. */
export function parseSolarLocation(text: string): HeliographicPoint | null {
  const match = LOCATION_PATTERN.exec(text.trim());
  if (!match) {
    return null;
  }
  const [, ns, lat, ew, lon] = match;
  return { latDeg: (ns === 'N' ? 1 : -1) * Number(lat), lonDeg: (ew === 'W' ? 1 : -1) * Number(lon) };
}

/** Format a Stonyhurst point back as "N06W28". */
export function formatSolarLocation(point: HeliographicPoint): string {
  const lat = Math.round(Math.abs(point.latDeg));
  const lon = Math.round(Math.abs(point.lonDeg));
  return `${point.latDeg < 0 ? 'S' : 'N'}${String(lat).padStart(2, '0')}${point.lonDeg < 0 ? 'E' : 'W'}${String(lon).padStart(2, '0')}`;
}
