import {
  ApsisKind,
  Body,
  Illumination,
  MoonPhase,
  NextLunarApsis,
  SearchGlobalSolarEclipse,
  SearchLunarApsis,
  SearchLunarEclipse,
} from 'astronomy-engine';

// Pure ephemeris math — no network, no Three.js/React (src/astro rule). All
// values are computed from `date` so tests can pin a fixed instant.

export interface ApsisInfo {
  kind: 'perigee' | 'apogee';
  /** ISO timestamp of the apsis. */
  date: string;
  distanceKm: number;
}

export interface EclipseInfo {
  /** e.g. "partial", "total", "penumbral", "annular". */
  kind: string;
  /** ISO timestamp of greatest eclipse. */
  date: string;
}

export interface MoonInfo {
  /** Phase angle 0..360° (0 = new, 90 = first quarter, 180 = full). */
  phaseAngle: number;
  phaseName: string;
  /** Illuminated fraction of the disc, 0..1. */
  illumination: number;
  /** True in the waxing half (right-lit in the northern hemisphere). */
  waxing: boolean;
  /** Earth–Moon centre distance right now, km. */
  currentDistanceKm: number;
  nextPerigee: ApsisInfo;
  nextApogee: ApsisInfo;
  nextLunarEclipse: EclipseInfo;
  nextSolarEclipse: EclipseInfo;
}

// Named phases with a small tolerance band around the exact quarter angles.
const QUARTER_TOLERANCE = 5;

export function phaseName(angle: number): string {
  const a = ((angle % 360) + 360) % 360;
  if (a < QUARTER_TOLERANCE || a > 360 - QUARTER_TOLERANCE) {
    return 'New Moon';
  }
  if (Math.abs(a - 90) < QUARTER_TOLERANCE) {
    return 'First Quarter';
  }
  if (Math.abs(a - 180) < QUARTER_TOLERANCE) {
    return 'Full Moon';
  }
  if (Math.abs(a - 270) < QUARTER_TOLERANCE) {
    return 'Last Quarter';
  }
  if (a < 90) {
    return 'Waxing Crescent';
  }
  if (a < 180) {
    return 'Waxing Gibbous';
  }
  if (a < 270) {
    return 'Waning Gibbous';
  }
  return 'Waning Crescent';
}

function apsisInfo(kind: number, date: string, distanceKm: number): ApsisInfo {
  return { kind: kind === ApsisKind.Pericenter ? 'perigee' : 'apogee', date, distanceKm };
}

const KM_PER_AU = 149597870.7;

export function computeMoonInfo(date: Date): MoonInfo {
  const phaseAngle = MoonPhase(date);
  const illum = Illumination(Body.Moon, date);
  const illumination = illum.phase_fraction;

  // The next apsis is either a perigee or an apogee; the following one is the
  // opposite, so one search plus one step gives both.
  const first = SearchLunarApsis(date);
  const second = NextLunarApsis(first);
  const firstInfo = apsisInfo(first.kind, first.time.date.toISOString(), first.dist_km);
  const secondInfo = apsisInfo(second.kind, second.time.date.toISOString(), second.dist_km);
  const nextPerigee = firstInfo.kind === 'perigee' ? firstInfo : secondInfo;
  const nextApogee = firstInfo.kind === 'apogee' ? firstInfo : secondInfo;

  const lunar = SearchLunarEclipse(date);
  const solar = SearchGlobalSolarEclipse(date);

  return {
    phaseAngle,
    phaseName: phaseName(phaseAngle),
    illumination,
    waxing: phaseAngle < 180,
    currentDistanceKm: illum.geo_dist * KM_PER_AU,
    nextPerigee,
    nextApogee,
    nextLunarEclipse: { kind: String(lunar.kind), date: lunar.peak.date.toISOString() },
    nextSolarEclipse: { kind: String(solar.kind), date: solar.peak.date.toISOString() },
  };
}
