import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { earthLayers, solarLayers, sunLayers, DEFAULT_ENABLED_LAYERS, DEFAULT_SOLAR_LAYERS, DEFAULT_SUN_LAYERS } from '../layers/registry';
import type { LayerTime } from '../layers/types';
import { markerFocusKey } from '../render/solarSystemScene';
import { SolarStage } from './SolarStage';
import { SPACECRAFT } from '../layers/spacecraftLayer';
import { EarthStage } from './EarthStage';
import { SunStage } from './SunStage';
import type { LayerSelection, LayerStatesRef, LayerStatusMap } from './layerHost';
import { LayerPanel } from './LayerPanel';
import { SUN_CHANNELS } from './sunImagery';
import { Inspector } from './Inspector';
import { StatusBar } from './StatusBar';
import { TimeScrubber } from './TimeScrubber';
import { useSceneState } from './useSceneState';
import type { InspectorPanelId } from './panels';
import type { SceneId } from './sceneState';
import type { StartScene } from '../settings/globalSettings';

// Matches the 700px phone breakpoint in style.css.
const NARROW_QUERY = '(max-width: 700px)';

const SCENE_TABS: { id: SceneId; label: string }[] = [
  { id: 'earth', label: 'Earth' },
  { id: 'sun', label: 'Sun' },
  { id: 'solar-system', label: 'Solar System' },
];

const KNOWN_LAYERS = earthLayers.map((layer) => layer.id);
const KNOWN_SOLAR_LAYERS = solarLayers.map((layer) => layer.id);
const KNOWN_SUN_LAYERS = sunLayers.map((layer) => layer.id);

const EARTH_STYLE_OPTIONS = [
  { value: 'globe', label: 'Photo (day/night)' },
  { value: 'satellite', label: 'Satellite (~2 days old)' },
  { value: 'map', label: 'Flat map (no shadow)' },
];

const SUN_CHANNEL_OPTIONS = SUN_CHANNELS.map(({ value, label }) => ({ value, label }));

// Fly-to targets on the Solar System tab, grouped by parent.
const SOLAR_BODIES: { name: string; moons: string[] }[] = [
  { name: 'Mercury', moons: [] },
  { name: 'Venus', moons: [] },
  { name: 'Earth', moons: ['Moon'] },
  { name: 'Mars', moons: ['Phobos', 'Deimos'] },
  { name: 'Jupiter', moons: ['Io', 'Europa', 'Ganymede', 'Callisto'] },
  { name: 'Saturn', moons: ['Mimas', 'Enceladus', 'Tethys', 'Dione', 'Rhea', 'Titan', 'Iapetus'] },
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
  /** Low-power rendering (30 fps, 1× pixel ratio) and smaller textures. */
  dataSaver?: boolean;
  /** The "Open on" setting; only read on mount. */
  startScene?: StartScene;
}

// The whole UI: one big scene (Earth / Sun / Solar System) with every
// geographic source as a toggleable layer on a single globe, a shared time
// cursor, a status strip, and an inspector for details.
export function SceneView({ labelScale, rotateSpeed, dataSaver = false, startScene = 'last' }: SceneViewProps) {
  const { state, setScene, toggle, toggleSolar, toggleSun, setLayerSetting, setEarthStyle, setSunWavelength } = useSceneState(
    KNOWN_LAYERS,
    DEFAULT_ENABLED_LAYERS,
    KNOWN_SOLAR_LAYERS,
    DEFAULT_SOLAR_LAYERS,
    KNOWN_SUN_LAYERS,
    DEFAULT_SUN_LAYERS,
    startScene === 'last' ? null : startScene,
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
  const enabledSunLayers = useMemo(() => sunLayers.filter((layer) => state.sunLayers.includes(layer.id)), [state.sunLayers]);
  const sceneLayers = state.scene === 'earth' ? enabledLayers : state.scene === 'sun' ? enabledSunLayers : enabledSolarLayers;

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

  // Back to the inspector's overview; the sheet (on phones) stays open.
  function closeDetails() {
    setSelection(null);
    setPanel(null);
  }

  function changeScene(id: SceneId) {
    setScene(id);
    setSelection(null);
  }

  const craftSetting = state.layerSettings.spacecraft?.craft;
  const visibleSpacecraft = SPACECRAFT.filter((craft) => !Array.isArray(craftSetting) || craftSetting.includes(craft.id));

  // A selection belongs to a layer of the current scene — drop it if that
  // layer is switched off.
  const sceneLayerIds = sceneLayers.map((layer) => layer.id);
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
        dataSaver={dataSaver}
        statesRef={statesRef}
        onStatus={onStatus}
        onSelect={select}
      />
    ) : state.scene === 'sun' ? (
      <SunStage
        layers={enabledSunLayers}
        layerSettings={state.layerSettings}
        wavelength={state.sunWavelength}
        labelScale={labelScale}
        dataSaver={dataSaver}
        selection={liveSelection}
        statesRef={statesRef}
        onStatus={onStatus}
        onSelect={select}
        onOpenPanel={openPanel}
      />
    ) : (
      <SolarStage
        layers={enabledSolarLayers}
        layerSettings={state.layerSettings}
        time={time}
        focus={solarFocus}
        labelScale={labelScale}
        rotateSpeed={rotateSpeed}
        dataSaver={dataSaver}
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
        surface={{
          idPrefix: 'scene-earth-style',
          label: 'Earth surface',
          options: EARTH_STYLE_OPTIONS,
          value: state.earthStyle,
          onChange: setEarthStyle,
        }}
        onToggle={toggle}
        onChangeSetting={setLayerSetting}
      />
    ) : state.scene === 'sun' ? (
      <div className="layer-panel">
        <h2 className="panel-heading">The Sun</h2>
        <p className="card-status">
          The latest SDO image (every ~15 min) with today's sunspot regions and recent flares on it. Drag to pan, scroll or
          pinch to zoom. Click a marker for details; flares, solar wind and the solar cycle are under Details.
        </p>
        <LayerPanel
          layers={sunLayers}
          enabled={state.sunLayers}
          settings={state.layerSettings}
          statuses={statuses}
          surface={{
            idPrefix: 'scene-sun-channel',
            label: 'Wavelength',
            options: SUN_CHANNEL_OPTIONS,
            value: state.sunWavelength,
            onChange: setSunWavelength,
          }}
          onToggle={toggleSun}
          onChangeSetting={setLayerSetting}
        />
        <p className="card-status body-credits">
          Images: NASA SDO (AIA, HMI). Regions and flares: NOAA SWPC; positions are carried forward by solar rotation from
          the daily report.
        </p>
      </div>
    ) : (
      <div className="layer-panel">
        <h2 className="panel-heading">Solar System</h2>
        <p className="card-status">
          Planets and the largest moons (Earth, Mars, Jupiter, Saturn) at the time on the scrubber, each turned on its real axis. Sizes are to
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
          (CC BY 4.0); Galilean moons: NASA/JPL/USGS; Saturn's moons: NASA/JPL/SSI (Cassini); Phobos &amp; Deimos:{' '}
          <a className="detail-link" href="https://commons.wikimedia.org/wiki/File:Phobos_map_by_Askaniy.png" target="_blank" rel="noreferrer">Askaniy</a> (CC BY-SA 3.0).
        </p>
      </div>
    );

  const inspector = (
    <Inspector
      scene={state.scene}
      selection={liveSelection}
      panel={panel}
      layers={sceneLayers}
      statuses={statuses}
      statesRef={statesRef}
      onOpenPanel={openPanel}
      onShowSun={() => changeScene('sun')}
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
              onClick={() => changeScene(tab.id)}
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
        <div
          className={`scene-sheet scene-sheet-${sheet}${sheet === 'details' && panel ? ' scene-sheet-panel' : ''}`}
          data-testid="scene-sheet"
        >
          <div className="scene-sheet-tabs">
            <button
              type="button"
              className={sheet === 'layers' ? 'scene-tab scene-tab-active' : 'scene-tab'}
              onClick={() => setSheet((s) => (s === 'layers' ? 'closed' : 'layers'))}
            >
              Layers
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
