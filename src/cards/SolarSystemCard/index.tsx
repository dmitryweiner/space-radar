import { useEffect, useRef, useState } from 'react';
import { computePlanetPositions } from '../../astro/planetPositions';
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

    function updatePositions() {
      scene.setPlanetPositions(computePlanetPositions(new Date()));
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
