import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { earthLayers, DEFAULT_ENABLED_LAYERS } from '../layers/registry';
import type { LayerState, LayerTime } from '../layers/types';
import { SolarSystemCard } from '../cards/SolarSystemCard';
import { SolarImageryCard } from '../cards/SolarImageryCard';
import { EarthStage, type LayerSelection, type LayerStatusMap } from './EarthStage';
import { LayerPanel } from './LayerPanel';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { TimeScrubber } from './TimeScrubber';
import { useSceneState } from './useSceneState';
import type { InspectorPanelId } from './panels';
import type { SceneId } from './sceneState';

// Matches GridLayout.MOBILE_BREAKPOINT_PX / the #cardMenu CSS breakpoint.
const NARROW_QUERY = '(max-width: 700px)';

const SCENE_TABS: { id: SceneId; label: string }[] = [
  { id: 'earth', label: 'Earth' },
  { id: 'sun', label: 'Sun' },
  { id: 'solar-system', label: 'Solar System' },
];

const KNOWN_LAYERS = earthLayers.map((layer) => layer.id);

function matchNarrow(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;
}

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(matchNarrow);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

type Sheet = 'closed' | 'layers' | 'details';

interface SceneViewProps {
  labelScale: number;
  rotateSpeed: number;
}

// The default UI: one big scene (Earth / Sun / Solar System) with every
// geographic source as a toggleable layer on a single globe, a shared time
// cursor, a status strip, and an inspector for details. The card dashboard
// remains available via the header toggle.
export function SceneView({ labelScale, rotateSpeed }: SceneViewProps) {
  const { state, setScene, toggle, setLayerSetting, setEarthStyle } = useSceneState(KNOWN_LAYERS, DEFAULT_ENABLED_LAYERS);
  const [time, setTime] = useState<LayerTime>(null);
  const [selection, setSelection] = useState<LayerSelection | null>(null);
  const [panel, setPanel] = useState<InspectorPanelId | null>(null);
  const [statuses, setStatuses] = useState<LayerStatusMap>({});
  const [sheet, setSheet] = useState<Sheet>('closed');
  const statesRef = useRef<Record<string, LayerState>>({});
  const narrow = useIsNarrow();

  const enabledLayers = useMemo(
    () => earthLayers.filter((layer) => state.enabledLayers.includes(layer.id)),
    [state.enabledLayers],
  );

  const onStatus = useCallback((id: string, status: LayerStatusMap[string] | null) => {
    setStatuses((prev) => {
      if (status === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: status };
    });
  }, []);

  const select = useCallback((next: LayerSelection) => {
    setSelection(next);
    setPanel(null);
    setSheet('details');
  }, []);

  function openPanel(id: InspectorPanelId) {
    setSelection(null);
    setPanel(id);
    setSheet('details');
  }

  function closeDetails() {
    setSelection(null);
    setPanel(null);
    if (narrow) setSheet('closed');
  }

  // A selection belongs to a layer — drop it if that layer is switched off.
  const liveSelection = selection && state.enabledLayers.includes(selection.layerId) ? selection : null;

  const stage =
    state.scene === 'earth' ? (
      <EarthStage
        layers={enabledLayers}
        layerSettings={state.layerSettings}
        time={time}
        earthStyle={state.earthStyle}
        labelScale={labelScale}
        rotateSpeed={rotateSpeed}
        statesRef={statesRef}
        onStatus={onStatus}
        onSelect={select}
      />
    ) : state.scene === 'sun' ? (
      <div className="sun-stage">
        <SolarImageryCard settings={{ layers: ['0193'] }} />
      </div>
    ) : (
      <SolarSystemCard time={time} />
    );

  const layerPanel =
    state.scene === 'earth' ? (
      <LayerPanel
        layers={earthLayers}
        enabled={state.enabledLayers}
        settings={state.layerSettings}
        statuses={statuses}
        earthStyle={state.earthStyle}
        onToggle={toggle}
        onChangeSetting={setLayerSetting}
        onChangeEarthStyle={setEarthStyle}
      />
    ) : (
      <div className="layer-panel">
        <h2 className="panel-heading">{state.scene === 'sun' ? 'The Sun' : 'Solar System'}</h2>
        <p className="card-status">
          {state.scene === 'sun'
            ? 'The Sun right now in extreme ultraviolet (SDO, 193 Å). Flares, sunspot regions and the solar cycle are in the panels on the right.'
            : 'Planets and the Moon/Galilean moons at the time on the scrubber. Moons ride exaggerated display orbits.'}
        </p>
      </div>
    );

  const inspector = (
    <Inspector
      scene={state.scene}
      selection={liveSelection}
      panel={panel}
      layers={enabledLayers}
      statuses={statuses}
      statesRef={statesRef}
      onOpenPanel={openPanel}
      onClose={closeDetails}
    />
  );

  // Timeline only means something where layers are time-aware.
  const showScrubber = state.scene !== 'sun';

  return (
    <div className={narrow ? 'scene-view scene-view-narrow' : 'scene-view'} data-testid="scene-view" data-free-gestures>
      <div className="scene-toolbar">
        <div className="scene-tabs" role="tablist" aria-label="Scene">
          {SCENE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={state.scene === tab.id}
              className={state.scene === tab.id ? 'scene-tab scene-tab-active' : 'scene-tab'}
              onClick={() => {
                setScene(tab.id);
                setSelection(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {showScrubber && <TimeScrubber time={time} onChange={setTime} />}
      </div>
      {narrow && <StatusBar onOpen={openPanel} />}
      <div className="scene-body">
        {!narrow && <aside className="scene-side scene-layers">{layerPanel}</aside>}
        <main className="scene-stage">
          {stage}
          {!narrow && <StatusBar onOpen={openPanel} />}
        </main>
        {!narrow && <aside className="scene-side scene-inspector">{inspector}</aside>}
      </div>
      {narrow && (
        <div className={`scene-sheet scene-sheet-${sheet}`} data-testid="scene-sheet">
          <div className="scene-sheet-tabs">
            <button
              type="button"
              className={sheet === 'layers' ? 'scene-tab scene-tab-active' : 'scene-tab'}
              onClick={() => setSheet((s) => (s === 'layers' ? 'closed' : 'layers'))}
            >
              {state.scene === 'earth' ? 'Layers' : 'About'}
            </button>
            <button
              type="button"
              className={sheet === 'details' ? 'scene-tab scene-tab-active' : 'scene-tab'}
              onClick={() => setSheet((s) => (s === 'details' ? 'closed' : 'details'))}
            >
              Details
            </button>
            {sheet !== 'closed' && (
              <button type="button" className="card-shell-action scene-sheet-close" aria-label="Close sheet" onClick={() => setSheet('closed')}>
                ⌄
              </button>
            )}
          </div>
          {sheet !== 'closed' && <div className="scene-sheet-body">{sheet === 'layers' ? layerPanel : inspector}</div>}
        </div>
      )}
    </div>
  );
}
