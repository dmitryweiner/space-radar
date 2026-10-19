import { useEffect, useRef, useState } from 'react';
import { createEarthScene, type EarthSceneHandle } from '../render/earthScene';
import { subsolarPoint } from '../astro/subsolar';
import type { CardSettingValues } from '../settings/types';
import { applyFrame } from '../layers/applyFrame';
import { useGibsTexture } from '../layers/useGibsTexture';
import type { LayerDefinition, LayerTime } from '../layers/types';
import { useReportLayerState, type LayerSelection, type LayerStatesRef, type OnLayerStatus } from './layerHost';

const SUN_UPDATE_MS = 60 * 1000;
const FLYBY_VIEW_DISTANCE = 26;

interface LayerHostProps {
  layer: LayerDefinition;
  scene: EarthSceneHandle;
  settings: CardSettingValues;
  time: LayerTime;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
}

// Renders nothing: runs one layer's hook (hooks can't be called in a loop, so
// each enabled layer gets its own host) and feeds its frame to the globe.
function LayerHost({ layer, scene, settings, time, statesRef, onStatus }: LayerHostProps) {
  const state = layer.useLayer(settings, time);
  const target = scene.layer(layer.id);
  useReportLayerState(layer.id, state, statesRef, onStatus);

  useEffect(() => {
    applyFrame(target, state.frame);
  }, [target, state.frame]);

  useEffect(() => () => scene.removeLayer(layer.id), [scene, layer.id]);

  return null;
}

interface EarthStageProps {
  layers: LayerDefinition[];
  layerSettings: Record<string, CardSettingValues>;
  time: LayerTime;
  earthStyle: string;
  labelScale: number;
  rotateSpeed: number;
  dataSaver?: boolean;
  statesRef: LayerStatesRef;
  onStatus: OnLayerStatus;
  onSelect: (selection: LayerSelection) => void;
}

export function EarthStage({
  layers,
  layerSettings,
  time,
  earthStyle,
  labelScale,
  rotateSpeed,
  dataSaver = false,
  statesRef,
  onStatus,
  onSelect,
}: EarthStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scene, setScene] = useState<EarthSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const satelliteTexture = useGibsTexture(earthStyle === 'satellite', dataSaver);
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
    scene?.setLowPower(dataSaver);
  }, [scene, dataSaver]);
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
