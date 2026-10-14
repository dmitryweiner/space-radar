import { useEffect, useRef, useState } from 'react';
import { computePlanetOrbitPath, computePlanetPositions } from '../../astro/planetPositions';
import { computeMoonPositions } from '../../astro/moonPositions';
import { createSolarSystemScene, type SolarSystemSceneHandle } from '../../render/solarSystemScene';
import type { CardComponentProps } from '../../layout/types';

const POSITION_UPDATE_MS = 60_000;

export function SolarSystemCard({ time = null }: CardComponentProps) {
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

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Live: refresh each minute. Scrubbed: jump to the chosen instant.
  useEffect(() => {
    function updatePositions() {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }
      const at = new Date(time ?? Date.now());
      // Planet positions first: setMoons reads the planet meshes' positions.
      scene.setPlanetPositions(computePlanetPositions(at));
      scene.setMoons(computeMoonPositions(at));
    }
    updatePositions();
    if (time !== null) {
      return undefined;
    }
    const interval = setInterval(updatePositions, POSITION_UPDATE_MS);
    return () => clearInterval(interval);
  }, [time]);

  return (
    <div className="solar-system-wrap">
      <canvas ref={canvasRef} className="solar-system-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
    </div>
  );
}
