import { useEffect, useRef, useState } from 'react';
import { createEarthScene, type EarthSceneHandle, type MarkerHit } from '../render/earthScene';
import { subsolarPoint } from '../astro/subsolar';
import type { CardComponentProps } from '../layout/types';
import { stringSetting } from '../layout/layoutState';
import type { LayerDefinition } from '../layers/types';
import { applyFrame } from '../layers/applyFrame';
import { useGibsTexture } from '../layers/useGibsTexture';
import { MarkerInfoPopup } from './MarkerInfoPopup';

// The terminator creeps ~0.25°/min — a once-a-minute nudge is plenty.
const SUN_UPDATE_MS = 60 * 1000;

interface GlobeLayerCardProps extends CardComponentProps {
  layer: LayerDefinition;
}

// One dashboard globe card = one layer on its own globe. (The Scene view draws
// every enabled layer on a single shared globe instead.) All five geographic
// cards are this component with a different layer.
export function GlobeLayerCard({ layer, settings = {}, labelScale = 1, rotateSpeed = 1 }: GlobeLayerCardProps) {
  const earthStyle = stringSetting(settings, 'earthStyle', 'globe');
  const state = layer.useLayer(settings, null);
  const satelliteTexture = useGibsTexture(earthStyle === 'satellite');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<EarthSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [selection, setSelection] = useState<MarkerHit | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      const scene = createEarthScene(canvas);
      sceneRef.current = scene;
      scene.setOnMarkerClick((hit) => setSelection(hit));
      const sunTimer = setInterval(() => scene.setSunPosition(subsolarPoint(new Date())), SUN_UPDATE_MS);
      return () => {
        clearInterval(sunTimer);
        scene.dispose();
        sceneRef.current = null;
      };
    } catch {
      queueMicrotask(() => setSceneError('3D rendering is not available in this browser.'));
      return undefined;
    }
  }, []);

  useEffect(() => {
    sceneRef.current?.setLabelScale(labelScale);
  }, [labelScale]);

  useEffect(() => {
    sceneRef.current?.setEarthStyle(earthStyle);
  }, [earthStyle]);

  useEffect(() => {
    sceneRef.current?.setSatelliteTexture(satelliteTexture);
  }, [satelliteTexture]);

  useEffect(() => {
    sceneRef.current?.setAutoRotateSpeed(rotateSpeed);
  }, [rotateSpeed]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) {
      applyFrame(scene, state.frame);
    }
  }, [state.frame]);

  const details = selection ? state.describe(selection) : null;
  const ready = !sceneError && !state.loading && !state.error;

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && state.loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && state.error && <p className="card-status card-status-error globe-overlay">{state.error}</p>}
      {ready && state.summary && <p className="card-status globe-overlay">{state.summary}</p>}
      {ready && state.legend.length > 0 && (
        <div className="globe-legend">
          {state.legend.map((item) => (
            <span key={item.label} className="globe-legend-item">
              <span className="globe-legend-swatch" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
      {details && (
        <MarkerInfoPopup
          title={details.title}
          fields={details.fields}
          detailUrl={details.detailUrl}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
