import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec } from 'satellite.js';
import type { TleRecord } from '../api/types';

export interface SatellitePosition {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}

export function computeSatellitePosition(tle: TleRecord, date: Date): SatellitePosition | null {
  const satrec = twoline2satrec(tle.line1, tle.line2);
  const result = propagate(satrec, date);
  if (!result) {
    return null;
  }
  const { x, y, z } = result.position;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }

  const gmst = gstime(date);
  const geodetic = eciToGeodetic(result.position, gmst);
  return {
    latitudeDeg: degreesLat(geodetic.latitude),
    longitudeDeg: degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
  };
}
