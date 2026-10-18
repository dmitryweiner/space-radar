import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { earthLayers, solarLayers, DEFAULT_ENABLED_LAYERS, DEFAULT_SOLAR_LAYERS } from '../layers/registry';
import type { LayerTime } from '../layers/types';
import { markerFocusKey } from '../render/solarSystemScene';
import { SolarStage } from './SolarStage';
import { SPACECRAFT } from '../layers/spacecraftLayer';
import { SolarImageryCard } from '../cards/SolarImageryCard';
import { EarthStage } from './EarthStage';
import type { LayerSelection, LayerStatesRef, LayerStatusMap } from './layerHost';
import { LayerPanel } from './LayerPanel';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { TimeScrubber } from './TimeScrubber';
import { useSceneState } from './useSceneState';
import type { InspectorPanelId } from './panels';
import type { SceneId } from './sceneState';

// Matches the 700px phone breakpoint in style.css.
const NARROW_QUERY = '(max-width: 700px)';

const SCENE_TABS: { id: SceneId; label: string }[] = [
  { id: 'earth', label: 'Earth' },
  { id: 'sun', label: 'Sun' },
  { id: 'solar-system', label: 'Solar System' },
];

const KNOWN_LAYERS = earthLayers.map((layer) => layer.id);
const KNOWN_SOLAR_LAYERS = solarLayers.map((layer) => layer.id);

// Fly-to targets on the Solar System tab, grouped by parent.
const SOLAR_BODIES: { name: string; moons: string[] }[] = [
  { name: 'Mercury', moons: [] },
  { name: 'Venus', moons: [] },
  { name: 'Earth', moons: ['Moon'] },
  { name: 'Mars', moons: [] },
  { name: 'Jupiter', moons: ['Io', 'Europa', 'Ganymede', 'Callisto'] },
  { name: 'Saturn', moons: [] },
  { name: 'Uranus', moons: [] },
  { name: 'Neptune', moons: [] },
];

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

// The whole UI: one big scene (Earth / Sun / Solar System) with every
// geographic source as a toggleable layer on a single globe, a shared time
// cursor, a status strip, and an inspector for details.
export function SceneView({ labelScale, rotateSpeed }: SceneViewProps) {
  const { state, setScene, toggle, toggleSolar, setLayerSetting, setEarthStyle } = useSceneState(
    KNOWN_LAYERS,
    DEFAULT_ENABLED_LAYERS,
    KNOWN_SOLAR_LAYERS,
    DEFAULT_SOLAR_LAYERS,
  );
  const [time, setTime] = useState<LayerTime>(null);
  const [selection, setSelection] = useState<LayerSelection | null>(null);
  const [panel, setPanel] = useState<InspectorPanelId | null>(null);
  const [statuses, setStatuses] = useState<LayerStatusMap>({});
  const [sheet, setSheet] = useState<Sheet>('closed');
  const [solarFocus, setSolarFocus] = useState<string | null>(null);
  const statesRef: LayerStatesRef = useRef({});
  const narrow = useIsNarrow();

  const enabledLayers = useMemo(
    () => earthLayers.filter((layer) => state.enabledLayers.includes(layer.id)),
    [state.enabledLayers],
  );
  const enabledSolarLayers = useMemo(
    () => solarLayers.filter((layer) => state.solarLayers.includes(layer.id)),
    [state.solarLayers],
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

  const craftSetting = state.layerSettings.spacecraft?.craft;
  const visibleSpacecraft = SPACECRAFT.filter((craft) => !Array.isArray(craftSetting) || craftSetting.includes(craft.id));

  // A selection belongs to a layer of the current scene — drop it if that
  // layer is switched off.
  const sceneLayerIds = state.scene === 'solar-system' ? state.solarLayers : state.enabledLayers;
  const liveSelection = selection && sceneLayerIds.includes(selection.layerId) ? selection : null;

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
      <SolarStage
        layers={enabledSolarLayers}
        layerSettings={state.layerSettings}
        time={time}
        focus={solarFocus}
        onFocusChange={setSolarFocus}
        statesRef={statesRef}
        onStatus={onStatus}
        onSelect={select}
      />
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
    ) : state.scene === 'sun' ? (
      <div className="layer-panel">
        <h2 className="panel-heading">The Sun</h2>
        <p className="card-status">
          The Sun right now in extreme ultraviolet (SDO, 193 Å). Flares, sunspot regions and the solar cycle are in the
          panels on the right.
        </p>
      </div>
    ) : (
      <div className="layer-panel">
        <h2 className="panel-heading">Solar System</h2>
        <p className="card-status">
          Planets and the Moon/Galilean moons at the time on the scrubber, each turned on its real axis. Sizes are to
          scale with each other (the Sun shrunk); moons ride exaggerated display orbits.
        </p>
        <LayerPanel
          layers={solarLayers}
          enabled={state.solarLayers}
          settings={state.layerSettings}
          statuses={statuses}
          onToggle={toggleSolar}
          onChangeSetting={setLayerSetting}
        />
        <h2 className="panel-heading">Fly to</h2>
        <div className="body-list" role="group" aria-label="Fly to">
          <button
            type="button"
            className={solarFocus === null ? 'body-chip body-chip-active' : 'body-chip'}
            aria-pressed={solarFocus === null}
            onClick={() => setSolarFocus(null)}
          >
            Whole system
          </button>
          {SOLAR_BODIES.map((planet) => (
            <div key={planet.name} className="body-group">
              {[planet.name, ...planet.moons].map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`${solarFocus === name ? 'body-chip body-chip-active' : 'body-chip'}${name === planet.name ? '' : ' body-chip-moon'}`}
                  aria-pressed={solarFocus === name}
                  onClick={() => setSolarFocus(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ))}
          {state.solarLayers.includes('spacecraft') && (
            <div className="body-group">
              {visibleSpacecraft.map((craft) => {
                const key = markerFocusKey('spacecraft', craft.id);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`${solarFocus === key ? 'body-chip body-chip-active' : 'body-chip'} body-chip-craft`}
                    aria-pressed={solarFocus === key}
                    onClick={() => setSolarFocus(key)}
                  >
                    {craft.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <p className="card-status body-credits">
          Surface maps: <a className="detail-link" href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a>{' '}
          (CC BY 4.0); Galilean moons: NASA/JPL/USGS.
        </p>
      </div>
    );

  const inspector = (
    <Inspector
      scene={state.scene}
      selection={liveSelection}
      panel={panel}
      layers={state.scene === 'solar-system' ? enabledSolarLayers : enabledLayers}
      statuses={statuses}
      statesRef={statesRef}
      onOpenPanel={openPanel}
      onClose={closeDetails}
    />
  );

  // Timeline only means something where layers are time-aware.
  const showScrubber = state.scene !== 'sun';

  return (
    <div className={narrow ? 'scene-view scene-view-narrow' : 'scene-view'} data-testid="scene-view">
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
              <button type="button" className="icon-btn scene-sheet-close" aria-label="Close sheet" onClick={() => setSheet('closed')}>
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
