export interface SceneVector3 {
  x: number;
  y: number;
  z: number;
}

const DEFAULT_EARTH_RADIUS_KM = 6371;

export function geodeticToSceneVector(
  latitudeDeg: number,
  longitudeDeg: number,
  altitudeKm: number,
  earthRadiusUnits: number,
  earthRadiusKm: number = DEFAULT_EARTH_RADIUS_KM,
): SceneVector3 {
  const scale = earthRadiusUnits / earthRadiusKm;
  const radius = (earthRadiusKm + altitudeKm) * scale;
  const latRad = (latitudeDeg * Math.PI) / 180;
  const lonRad = (longitudeDeg * Math.PI) / 180;
  return {
    x: radius * Math.cos(latRad) * Math.cos(lonRad),
    y: radius * Math.sin(latRad),
    z: -radius * Math.cos(latRad) * Math.sin(lonRad),
  };
}

export function heliocentricToSceneVector(xAu: number, yAu: number, zAu: number, unitsPerAu: number): SceneVector3 {
  return { x: xAu * unitsPerAu, y: zAu * unitsPerAu, z: -yAu * unitsPerAu };
}
