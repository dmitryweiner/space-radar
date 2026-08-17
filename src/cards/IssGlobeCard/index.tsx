import { useEffect, useMemo, useRef, useState } from 'react';
import { computeSatellitePosition } from '../../astro/satellitePosition';
import { geodeticToSceneVector, type SceneVector3 } from '../../astro/coords';
import { createEarthScene, EARTH_RADIUS_UNITS, type EarthSceneHandle, type NamedPosition } from '../../render/earthScene';
import type { TleRecord } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { listSetting, numberSetting, stringSetting } from '../../layout/layoutState';
import { useTleSatellites } from './useTleSatellites';
import { MarkerInfoPopup } from '../MarkerInfoPopup';

const POSITION_UPDATE_MS = 1000;
// The fading orbit trail behind each satellite: a ~40-minute arc (≈0.4 of a LEO
// orbit) sampled at a handful of points, recomputed each tick so it follows.
const TRAIL_SAMPLES = 20;
const TRAIL_SPAN_MS = 40 * 60 * 1000;

const DEFAULT_CATEGORIES = ['stations'];
const DEFAULT_MAX_SATELLITES = 30;

// Curated CelesTrak GP groups; see https://celestrak.org/NORAD/elements/.
export const SATELLITE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'stations', label: 'Space stations & nearby' },
  { value: 'visual', label: 'Brightest / visible' },
  { value: 'active', label: 'All active' },
  { value: 'starlink', label: 'Starlink' },
  { value: 'oneweb', label: 'OneWeb' },
  { value: 'gps-ops', label: 'GPS' },
  { value: 'galileo', label: 'Galileo' },
  { value: 'weather', label: 'Weather' },
  { value: 'noaa', label: 'NOAA' },
  { value: 'science', label: 'Science' },
  { value: 'amateur', label: 'Amateur radio' },
];

function findIss(records: TleRecord[]): TleRecord | null {
  return records.find((record) => /zarya|\biss\b/i.test(record.name)) ?? null;
}

// TLE line 1 format: "1 NNNNNU ..." — the NORAD catalog number is the 5-digit
// field right after the line number.
function noradCatalogNumber(line1: string): string | null {
  return line1.match(/^1\s+(\d+)/)?.[1] ?? null;
}

interface SatelliteDetails {
  title: string;
  fields: { label: string; value: string }[];
  detailUrl: string | null;
}

function satelliteDetails(record: TleRecord): SatelliteDetails {
  const noradId = noradCatalogNumber(record.line1);
  return {
    title: record.name,
    fields: noradId ? [{ label: 'NORAD ID', value: noradId }] : [],
    detailUrl: noradId ? `https://www.n2yo.com/satellite/?s=${noradId}` : null,
  };
}

type Selection = { kind: 'iss' } | { kind: 'satellite'; name: string } | null;

// Positions from now backward over TRAIL_SPAN_MS, ordered tail → head so the
// last point is the satellite's current location (the bright end of the trail).
function sampleTrail(tle: TleRecord, nowMs: number): SceneVector3[] {
  const points: SceneVector3[] = [];
  for (let i = TRAIL_SAMPLES - 1; i >= 0; i -= 1) {
    const t = new Date(nowMs - (i / (TRAIL_SAMPLES - 1)) * TRAIL_SPAN_MS);
    const position = computeSatellitePosition(tle, t);
    if (position) {
      points.push(geodeticToSceneVector(position.latitudeDeg, position.longitudeDeg, position.altitudeKm, EARTH_RADIUS_UNITS));
    }
  }
  return points;
}

function currentPositions(records: TleRecord[], nowMs: number): NamedPosition[] {
  const points: NamedPosition[] = [];
  const now = new Date(nowMs);
  for (const record of records) {
    const position = computeSatellitePosition(record, now);
    if (position) {
      points.push({
        name: record.name,
        position: geodeticToSceneVector(position.latitudeDeg, position.longitudeDeg, position.altitudeKm, EARTH_RADIUS_UNITS),
        trail: sampleTrail(record, nowMs),
      });
    }
  }
  return points;
}

export function IssGlobeCard({ settings = {}, labelScale = 1, rotateSpeed = 1 }: CardComponentProps) {
  const categories = listSetting(settings, 'categories', DEFAULT_CATEGORIES);
  const maxSatellites = numberSetting(settings, 'maxSatellites', DEFAULT_MAX_SATELLITES);
  const earthStyle = stringSetting(settings, 'earthStyle', 'globe');

  const { data, loading, error } = useTleSatellites(categories);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<EarthSceneHandle | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    try {
      const scene = createEarthScene(canvas);
      sceneRef.current = scene;
      scene.setOnMarkerClick((hit) => {
        if (hit.kind === 'iss') {
          setSelection({ kind: 'iss' });
        } else if (hit.kind === 'satellite') {
          setSelection({ kind: 'satellite', name: hit.name });
        }
      });
      return () => {
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
    sceneRef.current?.setAutoRotateSpeed(rotateSpeed);
  }, [rotateSpeed]);

  const iss = data ? findIss(data) : null;
  const otherSatellites = useMemo(() => {
    const others = data && iss ? data.filter((record) => record !== iss) : (data ?? []);
    return others.slice(0, maxSatellites);
  }, [data, iss, maxSatellites]);

  useEffect(() => {
    const scene = sceneRef.current;
    // Don't drive the scene until TLEs have loaded — otherwise the first mount
    // pushes an empty/null frame before any data arrives.
    if (!scene || !data) {
      return;
    }

    function updatePositions() {
      const activeScene = sceneRef.current;
      if (!activeScene) {
        return;
      }
      const nowMs = Date.now();
      const issPosition = iss ? computeSatellitePosition(iss, new Date(nowMs)) : null;
      activeScene.setIssPosition(
        issPosition
          ? geodeticToSceneVector(issPosition.latitudeDeg, issPosition.longitudeDeg, issPosition.altitudeKm, EARTH_RADIUS_UNITS)
          : null,
        iss ? sampleTrail(iss, nowMs) : [],
      );
      activeScene.setSatellites(currentPositions(otherSatellites, nowMs));
    }
    updatePositions();
    const interval = setInterval(updatePositions, POSITION_UPDATE_MS);
    return () => clearInterval(interval);
  }, [data, iss, otherSatellites]);

  const satelliteCount = otherSatellites.length + (iss ? 1 : 0);

  const selectedRecord: TleRecord | null =
    selection?.kind === 'iss' ? iss : selection?.kind === 'satellite' ? data?.find((record) => record.name === selection.name) ?? null : null;
  const selectedDetails = selectedRecord ? satelliteDetails(selectedRecord) : null;

  return (
    <div className="globe-wrap">
      <canvas ref={canvasRef} className="globe-canvas" />
      {sceneError && <p className="card-status card-status-error globe-overlay">{sceneError}</p>}
      {!sceneError && loading && <p className="card-status globe-overlay">Loading…</p>}
      {!sceneError && error && <p className="card-status card-status-error globe-overlay">{error}</p>}
      {!sceneError && !loading && !error && data && (
        <p className="card-status globe-overlay">
          {satelliteCount} satellite{satelliteCount === 1 ? '' : 's'}
        </p>
      )}
      {selectedDetails && (
        <MarkerInfoPopup
          title={selectedDetails.title}
          fields={selectedDetails.fields}
          detailUrl={selectedDetails.detailUrl}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
