import * as THREE from 'three';
import starsTextureUrl from '../assets/stars-milky-way.jpg';

export interface StarfieldHandle {
  mesh: THREE.Mesh;
  dispose(): void;
}

// Real-sky equirectangular star map (Milky Way panorama, solarsystemscope.com,
// CC BY 4.0) rendered on the inside of a large sphere. The camera sits inside
// the sphere, so orbiting rotates the sky along with the rest of the scene.
export function createStarfield(radius: number): StarfieldHandle {
  const texture = new THREE.TextureLoader().load(starsTextureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 32),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false }),
  );

  return {
    mesh,
    dispose() {
      mesh.geometry.dispose();
      mesh.material.dispose();
      texture.dispose();
    },
  };
}
