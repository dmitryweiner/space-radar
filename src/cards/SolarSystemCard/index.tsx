import { useEffect, useRef, useState } from 'react';
import { computePlanetOrbitPath, computePlanetPositions } from '../../astro/planetPositions';
import { computeMoonPositions } from '../../astro/moonPositions';
import { createSolarSystemScene, type SolarSystemSceneHandle } from '../../render/solarSystemScene';

const POSITION_UPDATE_MS = 60_000;

export function SolarSystemCard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SolarSystemSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let scene: SolarSystemSceneHandle;
    try {
      scene = createSolarSystemScene(canvas);
    } catch {
      queueMicrotask(() => setSceneError('3D rendering is not available in this browser.'));
      return undefined;
    }
    sceneRef.current = scene;

    const now = new Date();
    const initialPositions = computePlanetPositions(now);
    scene.setOrbitPaths(initialPositions.map((p) => ({ name: p.name, points: computePlanetOrbitPath(p.name, now) })));

    function updatePositions() {
      const at = new Date();
      // Planet positions first: setMoons reads the planet meshes' positions.
      scene.setPlanetPositions(computePlanetPositions(at));
      scene.setMoons(computeMoonPositions(at));
    }
    updatePositions();
    const interval = setInterval(updatePositions, POSITION_UPDATE_MS);

    return () => {
      clearInterval(interval);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className="solar-system-wrap">
      <canvas ref={canvasRef} className="solar-system-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
    </div>
  );
}
