import { Body, MakeTime, RotateVector, RotationAxis, Rotation_EQJ_ECL, Vector } from 'astronomy-engine';
import type { HeliocentricVector } from './planetPositions';

export interface BodyOrientation {
  /** Unit vector along the body's north rotation pole, J2000 ecliptic frame. */
  north: HeliocentricVector;
  /** Unit vector from the centre through the prime meridian on the equator
   * (longitude 0), J2000 ecliptic frame — turns with the body's spin. */
  meridian: HeliocentricVector;
}

// Bodies astronomy-engine has IAU rotation models for. The Galilean moons are
// not among them; the scene gives them their parent's axis.
const ROTATION_BODIES: Record<string, Body> = {
  Sun: Body.Sun,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Earth: Body.Earth,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Moon: Body.Moon,
};

const DEG = Math.PI / 180;

function toEcliptic(x: number, y: number, z: number, date: Date): HeliocentricVector {
  const v = RotateVector(Rotation_EQJ_ECL(), new Vector(x, y, z, MakeTime(date)));
  return { xAu: v.x, yAu: v.y, zAu: v.z };
}

// IAU convention: the prime meridian sits `spin` degrees east of the node where
// the body's equator crosses the J2000 equator, the node being at RA + 90°.
export function computeBodyOrientation(name: string, date: Date): BodyOrientation | null {
  const body = ROTATION_BODIES[name];
  if (body === undefined) {
    return null;
  }
  const axis = RotationAxis(body, date);
  const n = axis.north;
  const nodeRa = (axis.ra * 15 + 90) * DEG;
  const node = { x: Math.cos(nodeRa), y: Math.sin(nodeRa), z: 0 };
  // north × node: the equator direction 90° east of the node.
  const east = { x: n.y * node.z - n.z * node.y, y: n.z * node.x - n.x * node.z, z: n.x * node.y - n.y * node.x };
  const w = axis.spin * DEG;
  const cos = Math.cos(w);
  const sin = Math.sin(w);
  return {
    north: toEcliptic(n.x, n.y, n.z, date),
    meridian: toEcliptic(cos * node.x + sin * east.x, cos * node.y + sin * east.y, cos * node.z + sin * east.z, date),
  };
}
