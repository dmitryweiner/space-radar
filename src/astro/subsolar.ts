import { Body, EquatorFromVector, GeoVector, MakeTime, Rotation_EQJ_EQD, RotateVector, SiderealTime } from 'astronomy-engine';

// The sub-solar / sub-lunar point: where on Earth the Sun (or Moon) is
// directly overhead at a given instant. Drives the globe's day/night
// terminator (the "sun" light points from there) and the Moon marker.
// Pure ephemeris math — no Three.js/React (src/astro rule).

export interface SubPoint {
  latitudeDeg: number;
  longitudeDeg: number;
}

function subPoint(body: Body, date: Date): SubPoint {
  const time = MakeTime(date);
  // Geocentric (not topocentric) so the Moon gets no observer parallax, then
  // rotated from J2000 into the true equator of date, the frame sidereal time
  // is measured in.
  const ofDate = RotateVector(Rotation_EQJ_EQD(time), GeoVector(body, time, true));
  const equatorial = EquatorFromVector(ofDate);
  // Right ascension and Greenwich apparent sidereal time are both in hours.
  let longitudeDeg = (equatorial.ra - SiderealTime(time)) * 15;
  longitudeDeg = ((((longitudeDeg + 180) % 360) + 360) % 360) - 180;
  return { latitudeDeg: equatorial.dec, longitudeDeg };
}

export function subsolarPoint(date: Date): SubPoint {
  return subPoint(Body.Sun, date);
}

export function sublunarPoint(date: Date): SubPoint {
  return subPoint(Body.Moon, date);
}
