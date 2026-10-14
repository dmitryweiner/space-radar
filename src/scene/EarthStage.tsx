import { useEffect, useRef, useState } from 'react';
import { createEarthScene, type EarthSceneHandle, type MarkerHit } from '../render/earthScene';
import { subsolarPoint } from '../astro/subsolar';
import type { CardSettingValues } from '../layout/types';
import { applyFrame } from '../layers/applyFrame';
import { useGibsTexture } from '../layers/useGibsTexture';
import type { LayerDefinition, LayerState, LayerTime } from '../layers/types';

const SUN_UPDATE_MS = 60 * 1000;
const FLYBY_VIEW_DISTANCE = 26;

export interface LayerSelection {
  layerId: string;
  hit: MarkerHit;
}

/** What the panels need from a running layer — updated only on change. */
export type LayerStatusMap = Record<string, Pick<LayerState, 'loading' | 'error' | 'summary' | 'legend'>>;

interface LayerHostProps {
  layer: LayerDefinition;
  scene: EarthSceneHandle;
  settings: CardSettingValues;
  time: LayerTime;
  statesRef: React.MutableRefObject<Record<string, LayerState>>;
  onStatus: (id: string, status: LayerStatusMap[string] | null) => void;
}

// Renders nothing: runs one layer's hook (hooks can't be called in a loop, so
// each enabled layer gets its own host) and feeds its frame to the globe.
function LayerHost({ layer, scene, settings, time, statesRef, onStatus }: LayerHostProps) {
  const state = layer.useLayer(settings, time);
  const target = scene.layer(layer.id);

  // Latest full state (with describe()) for the inspector, outside render.
  useEffect(() => {
    statesRef.current[layer.id] = state;
  });

  useEffect(() => {
    applyFrame(target, state.frame);
  }, [target, state.frame]);

  useEffect(
    () => () => {
      scene.removeLayer(layer.id);
      delete statesRef.current[layer.id];
      onStatus(layer.id, null);
    },
    [scene, layer.id, statesRef, onStatus],
  );

  // Panels re-render only when what they show changes — not on every
  // per-second position tick of the ISS layer.
  const legendKey = state.legend.map((item) => `${item.label}:${item.color}`).join('|');
  const { loading, error, summary, legend } = state;
  useEffect(() => {
    onStatus(layer.id, { loading, error, summary, legend });
    // legend is tracked through legendKey (a new array every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.id, loading, error, summary, legendKey, onStatus]);

  return null;
}

interface EarthStageProps {
  layers: LayerDefinition[];
  layerSettings: Record<string, CardSettingValues>;
  time: LayerTime;
  earthStyle: string;
  labelScale: number;
  rotateSpeed: number;
  statesRef: React.MutableRefObject<Record<string, LayerState>>;
  onStatus: (id: string, status: LayerStatusMap[string] | null) => void;
  onSelect: (selection: LayerSelection) => void;
}

export function EarthStage({
  layers,
  layerSettings,
  time,
  earthStyle,
  labelScale,
  rotateSpeed,
  statesRef,
  onStatus,
  onSelect,
}: EarthStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<EarthSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const satelliteTexture = useGibsTexture(earthStyle === 'satellite');
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    let handle: EarthSceneHandle;
    try {
      handle = createEarthScene(canvas);
    } catch {
      queueMicrotask(() => setSceneError('3D rendering is not available in this browser.'));
      return undefined;
    }
    handle.setOnMarkerClick((hit, layerId) => onSelectRef.current({ hit, layerId }));
    queueMicrotask(() => setScene(handle));
    return () => {
      setScene(null);
      handle.dispose();
    };
  }, []);

  useEffect(() => {
    scene?.setLabelScale(labelScale);
  }, [scene, labelScale]);
  useEffect(() => {
    scene?.setAutoRotateSpeed(rotateSpeed);
  }, [scene, rotateSpeed]);
  useEffect(() => {
    scene?.setEarthStyle(earthStyle);
  }, [scene, earthStyle]);
  useEffect(() => {
    scene?.setSatelliteTexture(satelliteTexture);
  }, [scene, satelliteTexture]);

  // Asteroid flybys live out to ~0.2 AU on a compressed scale — far outside
  // the globe-sized default view. Zoom out when that layer comes on (once per
  // switch-on, so the user's own zoom afterwards is left alone).
  const flybysOn = layers.some((layer) => layer.id === 'neo-flyby');
  useEffect(() => {
    if (scene && flybysOn) {
      scene.setViewDistance(FLYBY_VIEW_DISTANCE);
    }
  }, [scene, flybysOn]);

  // The terminator follows the shared time cursor; live, it creeps each minute.
  useEffect(() => {
    if (!scene) {
      return undefined;
    }
    scene.setSunPosition(subsolarPoint(new Date(time ?? Date.now())));
    if (time !== null) {
      return undefined;
    }
    const timer = setInterval(() => scene.setSunPosition(subsolarPoint(new Date())), SUN_UPDATE_MS);
    return () => clearInterval(timer);
  }, [scene, time]);

  return (
    <div className="globe-wrap scene-globe">
      <canvas ref={canvasRef} className="globe-canvas" data-testid="scene-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {scene &&
        layers.map((layer) => (
          <LayerHost
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
