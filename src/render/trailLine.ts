import * as THREE from 'three';
import type { SceneVector3 } from '../astro/coords';

export interface TrailLine {
  line: THREE.Line;
  /** Points ordered tail → head; the head (last point) is the bright end. */
  setPoints(points: SceneVector3[]): void;
  dispose(): void;
}

// A fading orbit trail: a line whose per-vertex colour ramps from black at the
// tail to `headColor` at the head (the satellite's current position). Additive
// blending over the dark sky makes the black tail read as fully transparent, so
// the trail appears to fade out behind the moving satellite.
export function makeTrail(headColor: number): TrailLine {
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const color = new THREE.Color(headColor);
  const line = new THREE.Line(new THREE.BufferGeometry(), material);
  line.visible = false;

  return {
    line,
    setPoints(points) {
      line.geometry.dispose();
      if (points.length < 2) {
        line.visible = false;
        return;
      }
      line.visible = true;
      const count = points.length;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = points[i].x;
        positions[i * 3 + 1] = points[i].y;
        positions[i * 3 + 2] = points[i].z;
        // Quadratic ramp concentrates the brightness near the head.
        const t = (i / (count - 1)) ** 2;
        colors[i * 3] = color.r * t;
        colors[i * 3 + 1] = color.g * t;
        colors[i * 3 + 2] = color.b * t;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      line.geometry = geometry;
    },
    dispose() {
      line.geometry.dispose();
      material.dispose();
    },
  };
}
