import { getGlobalSettings } from '../settings/useGlobalSettings';
import type { TimeZoneSetting, UnitSystem } from '../settings/globalSettings';

// Display formatting that follows the general settings (time zone, units).
// Each formatter takes the setting as an optional last argument — defaulting
// to the current global value — so it's testable without the store. A
// component showing these should call useGlobalSettings() so it re-renders
// when a setting changes.

const KM_PER_MILE = 1.609344;

// "YYYY-MM-DD HH:MM[:SS…]" with no zone is UTC in every feed we read (SWPC
// time_tag, EPIC dates, FIRMS); an ISO string with Z/offset is taken as is.
const ZONELESS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function toMs(input: number | string | Date): number {
  if (typeof input === 'number') return input;
  if (input instanceof Date) return input.getTime();
  const trimmed = input.trim();
  return Date.parse(ZONELESS.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localZoneLabel(date: Date): string {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? 'local';
  } catch {
    return 'local';
  }
}

/** "2026-10-19 06:23 UTC", or in local time "2026-10-19 13:23 GMT+7".
 * Strings that don't parse as a date come back unchanged. */
export function formatTime(input: number | string | Date, zone: TimeZoneSetting = getGlobalSettings().timeZone): string {
  const ms = toMs(input);
  if (!Number.isFinite(ms)) return String(input);
  const d = new Date(ms);
  if (zone === 'utc') {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} ${localZoneLabel(d)}`;
}

/** Just the clock time, "06:52", in the configured zone (chart axes). */
export function formatClock(input: number | string | Date, zone: TimeZoneSetting = getGlobalSettings().timeZone): string {
  const ms = toMs(input);
  if (!Number.isFinite(ms)) return String(input);
  const d = new Date(ms);
  return zone === 'utc' ? `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A distance given in km, e.g. "1,234 km" / "767 mi". */
export function formatDistance(km: number, digits = 0, units: UnitSystem = getGlobalSettings().units): string {
  const value = units === 'imperial' ? km / KM_PER_MILE : km;
  const text = value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${text} ${units === 'imperial' ? 'mi' : 'km'}`;
}

/** A speed given in km/s, e.g. "7.7 km/s" / "4.8 mi/s". */
export function formatSpeed(kmPerS: number, digits = 1, units: UnitSystem = getGlobalSettings().units): string {
  const value = units === 'imperial' ? kmPerS / KM_PER_MILE : kmPerS;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units === 'imperial' ? 'mi/s' : 'km/s'}`;
}

/** A speed given in km/h, e.g. "45,000 km/h" / "27,962 mph". */
export function formatSpeedPerHour(kmPerH: number, units: UnitSystem = getGlobalSettings().units): string {
  const value = Math.round(units === 'imperial' ? kmPerH / KM_PER_MILE : kmPerH);
  return `${value.toLocaleString('en-US')} ${units === 'imperial' ? 'mph' : 'km/h'}`;
}

/** Unit label for a chart axis of speeds in km/s. */
export function speedUnit(units: UnitSystem = getGlobalSettings().units): string {
  return units === 'imperial' ? 'mi/s' : 'km/s';
}

/** A size range given in km, e.g. "0.12–0.27 km" / "0.07–0.17 mi". */
export function formatDiameter(minKm: number, maxKm: number, units: UnitSystem = getGlobalSettings().units): string {
  const f = units === 'imperial' ? 1 / KM_PER_MILE : 1;
  return `${(minKm * f).toFixed(2)}–${(maxKm * f).toFixed(2)} ${units === 'imperial' ? 'mi' : 'km'}`;
}
