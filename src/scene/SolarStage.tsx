import { useEffect, useMemo, useRef, useState } from 'react';
import { computePlanetOrbitPath, computePlanetPositions } from '../astro/planetPositions';
import { computeMoonPositions } from '../astro/moonPositions';
import { computeBodyOrientation, type BodyOrientation } from '../astro/bodyOrientation';
import { createSolarSystemScene, type SolarSystemSceneHandle } from '../render/solarSystemScene';
import type { CardSettingValues } from '../settings/types';
import type { LayerTime, SolarLayerDefinition } from '../layers/types';
import { useReportLayerState, type LayerSelection, type LayerStatesRef, type OnLayerStatus } from './layerHost';

const POSITION_UPDATE_MS = 60_000;

const ORIENTED_BODIES = ['Sun', 'Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Moon'];

function orientationsAt(at: Date): Record<string, BodyOrientation> {
  const result: Record<string, BodyOrientation> = {};
  for (const name of ORIENTED_BODIES) {
    const orientation = computeBodyOrientation(name, at);
    if (orientation) {
      result[name] = orientation;
    }
  }
  return result;
}

interface SolarLayerHostProps {
  layer: SolarLayerDefinition;
  scene: SolarSystemSceneHandle;
  settings: CardSettingValues;
  time: LayerTime;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
}

// Renders nothing: runs one layer's hook and feeds its frame to the scene.
function SolarLayerHost({ layer, scene, settings, time, statesRef, onStatus }: SolarLayerHostProps) {
  const state = layer.useLayer(settings, time);
  const target = useMemo(() => scene.layer(layer.id), [scene, layer.id]);
  useReportLayerState(layer.id, state, statesRef, onStatus);

  const { markers, tracks } = state.frame;
  useEffect(() => {
    if (markers) target.setMarkers(markers);
  }, [target, markers]);
  useEffect(() => {
    if (tracks) target.setTracks(tracks);
  }, [target, tracks]);

  useEffect(() => () => scene.removeLayer(layer.id), [scene, layer.id]);
  return null;
}

interface SolarStageProps {
  layers: SolarLayerDefinition[];
  layerSettings: Record<string, CardSettingValues>;
  time: LayerTime;
  /** What the camera follows: a planet/moon name or a marker key; null = whole system. */
  focus: string | null;
  onFocusChange: (key: string | null) => void;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
  /** A layer marker was picked (clicked, or focused when it arrived). */
  onSelect: (selection: LayerSelection) => void;
}

export function SolarStage({ layers, layerSettings, time, focus, onFocusChange, statesRef, onStatus, onSelect }: SolarStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<SolarSystemSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  // Display name of the focus (a marker key alone isn't readable).
  const [focusLabel, setFocusLabel] = useState<{ key: string; label: string } | null>(null);
  const callbacks = useRef({ onFocusChange, onSelect });
  useEffect(() => {
    callbacks.current = { onFocusChange, onSelect };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let handle: SolarSystemSceneHandle;
    try {
      handle = createSolarSystemScene(canvas);
    } catch {
      queueMicrotask(() => setSceneError('3D rendering is not available in this browser.'));
      return undefined;
    }
    handle.setOnFocusChange((next) => {
      setFocusLabel(next ? { key: next.key, label: next.label } : null);
      callbacks.current.onFocusChange(next ? next.key : null);
      if (next?.layerId && next.markerId) {
        callbacks.current.onSelect({ layerId: next.layerId, hit: { kind: 'marker', id: next.markerId } });
      }
    });
    const now = new Date();
    handle.setOrbitPaths(computePlanetPositions(now).map((p) => ({ name: p.name, points: computePlanetOrbitPath(p.name, now) })));
    queueMicrotask(() => setScene(handle));
    return () => {
      setScene(null);
      handle.dispose();
    };
  }, []);

  // Live: refresh each minute. Scrubbed: jump to the chosen instant.
  useEffect(() => {
    if (!scene) {
      return undefined;
    }
    function updatePositions() {
      if (!scene) return;
      const at = new Date(time ?? Date.now());
      // Planet positions first: setMoons reads the planet meshes' positions.
      scene.setPlanetPositions(computePlanetPositions(at));
      scene.setMoons(computeMoonPositions(at));
      scene.setOrientations(orientationsAt(at));
    }
    updatePositions();
    if (time !== null) {
      return undefined;
    }
    const interval = setInterval(updatePositions, POSITION_UPDATE_MS);
    return () => clearInterval(interval);
  }, [scene, time]);

  useEffect(() => {
    scene?.focusBody(focus);
  }, [scene, focus]);

  const label = focus && focusLabel?.key === focus ? focusLabel.label : focus;

  return (
    <div className="solar-system-wrap">
      <canvas ref={canvasRef} className="solar-system-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError &&
        (focus ? (
          <div className="globe-overlay solar-focus">
            <span className="solar-focus-name">{label}</span>
            <button type="button" className="tb-btn solar-focus-back" onClick={() => onFocusChange(null)}>
              ← Whole system
            </button>
          </div>
        ) : (
          <p className="card-status globe-overlay">Click a planet, moon, spacecraft or comet to fly there.</p>
        ))}
      {scene &&
        layers.map((layer) => (
          <SolarLayerHost
            key={layer.id}
            layer={layer}
            scene={scene}
            settings={layerSettings[layer.id] ?? {}}
            time={time}
            statesRef={statesRef}
            onStatus={onStatus}
          />
        ))}
    </div>
  );
}
