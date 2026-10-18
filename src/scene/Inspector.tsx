import { useEffect, useState } from 'react';
import type { LayerInfo, MarkerDetails } from '../layers/types';
import type { LayerSelection, LayerStatesRef, LayerStatusMap } from './layerHost';
import { INSPECTOR_PANELS, panelById, type InspectorPanelId } from './panels';
import type { SceneId } from './sceneState';
import { computeMoonInfo } from '../astro/moonInfo';

const SDO_193_THUMB = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg';

// Panels worth suggesting first for each scene.
const SCENE_PANELS: Record<SceneId, InspectorPanelId[]> = {
  earth: ['aurora-forecast', 'epic', 'launches', 'asteroids', 'moon', 'apod'],
  sun: ['flares', 'sun-images', 'solar-cycle', 'wind', 'kp', 'scales'],
  'solar-system': ['asteroids', 'moon', 'apod', 'nasa-images', 'launches'],
};

interface InspectorProps {
  scene: SceneId;
  selection: LayerSelection | null;
  panel: InspectorPanelId | null;
  layers: LayerInfo[];
  statuses: LayerStatusMap;
  statesRef: LayerStatesRef;
  onOpenPanel: (panel: InspectorPanelId) => void;
  onClose: () => void;
}

// Selected-marker details refresh every second (e.g. a flyby's distance-now
// changes as the time cursor moves) by re-reading the layer's latest state.
// Read in an effect (refs are off-limits during render) and tagged with the
// selection they belong to, so a new selection never shows stale details.
function useLiveDetails(selection: LayerSelection | null, statesRef: InspectorProps['statesRef']): MarkerDetails | null {
  const [read, setRead] = useState<{ for: LayerSelection; details: MarkerDetails | null } | null>(null);
  useEffect(() => {
    if (!selection) return undefined;
    const update = () => setRead({ for: selection, details: statesRef.current[selection.layerId]?.describe(selection.hit) ?? null });
    queueMicrotask(update);
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [selection, statesRef]);
  return read && read.for === selection ? read.details : null;
}

function MoonWidget() {
  const [info] = useState(() => computeMoonInfo(new Date()));
  return (
    <div className="widget-moon">
      <span className="widget-moon-phase">{info.phaseName}</span>
      <span className="widget-dim"> · {Math.round(info.illumination * 100)}% lit</span>
    </div>
  );
}

export function Inspector({ scene, selection, panel, layers, statuses, statesRef, onOpenPanel, onClose }: InspectorProps) {
  const details = useLiveDetails(selection, statesRef);
  const openPanel = panel ? panelById(panel) : undefined;

  if (selection) {
    return (
      <div className="inspector" data-testid="inspector">
        <div className="inspector-header">
          <span className="inspector-title">{details?.title ?? '…'}</span>
          <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>
            ×
          </button>
        </div>
        {details && (
          <dl className="detail-fields">
            {details.fields.map((field) => (
              <div key={field.label} className="detail-field">
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {details?.detailUrl && (
          <a href={details.detailUrl} target="_blank" rel="noreferrer" className="detail-link">
            Details ↗
          </a>
        )}
      </div>
    );
  }

  if (openPanel) {
    const Panel = openPanel.component;
    return (
      <div className="inspector" data-testid="inspector">
        <div className="inspector-header">
          <span className="inspector-title">{openPanel.title}</span>
          <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="inspector-panel-body">
          <Panel settings={openPanel.settings ?? {}} />
        </div>
      </div>
    );
  }

  const suggested = SCENE_PANELS[scene];
  const others = INSPECTOR_PANELS.filter((p) => !suggested.includes(p.id));
  return (
    <div className="inspector" data-testid="inspector">
      {scene !== 'sun' && (
        <section className="inspector-section">
          <h2 className="panel-heading">{scene === 'earth' ? 'On the globe' : 'In view'}</h2>
          {layers.length === 0 && <p className="card-status">No layers on — pick some on the left.</p>}
          {layers.map((layer) => {
            const status = statuses[layer.id];
            return (
              <div key={layer.id} className="legend-block">
                <div className="legend-block-title">
                  <span className="layer-swatch" style={{ backgroundColor: layer.color }} />
                  {layer.title}
                </div>
                {status?.legend.map((item) => (
                  <span key={item.label} className="legend-item">
                    <span className="legend-swatch" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            );
          })}
          <p className="card-status inspector-hint">Click a marker for details.</p>
        </section>
      )}
      <section className="inspector-section">
        <h2 className="panel-heading">Now</h2>
        <MoonWidget />
        <button type="button" className="widget-sun" onClick={() => onOpenPanel('sun-images')} title="The Sun right now (SDO, 193 Å)">
          <img src={SDO_193_THUMB} alt="The Sun right now, SDO 193 Å" loading="lazy" />
        </button>
      </section>
      <section className="inspector-section">
        <h2 className="panel-heading">More</h2>
        <div className="panel-links">
          {[...suggested.map((id) => panelById(id)), ...others].map(
            (p) =>
              p && (
                <button key={p.id} type="button" className="panel-link" onClick={() => onOpenPanel(p.id)}>
                  {p.title}
                </button>
              ),
          )}
        </div>
      </section>
    </div>
  );
}
