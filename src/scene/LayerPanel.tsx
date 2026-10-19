import { useState } from 'react';
import type { CardSettingValue, CardSettingValues } from '../settings/types';
import { SettingField } from '../settings/SettingField';
import { SelectField } from '../settings/SelectField';
import type { LayerInfo } from '../layers/types';
import type { LayerStatusMap } from './layerHost';

/** A radio group under the layer list (Earth's surface, the Sun's wavelength). */
export interface SurfacePicker {
  idPrefix: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

interface LayerPanelProps {
  layers: LayerInfo[];
  enabled: string[];
  settings: Record<string, CardSettingValues>;
  statuses: LayerStatusMap;
  onToggle: (id: string) => void;
  onChangeSetting: (id: string, key: string, value: CardSettingValue) => void;
  surface?: SurfacePicker;
}

function statusText(status: LayerStatusMap[string] | undefined): { text: string; error: boolean } | null {
  if (!status) return null;
  if (status.loading) return { text: 'Loading…', error: false };
  if (status.error) return { text: status.error, error: true };
  return status.summary ? { text: status.summary, error: false } : null;
}

export function LayerPanel({
  layers,
  enabled,
  settings,
  statuses,
  surface,
  onToggle,
  onChangeSetting,
}: LayerPanelProps) {
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  return (
    <div className="layer-panel" data-testid="layer-panel">
      <h2 className="panel-heading">Layers</h2>
      <ul className="layer-list">
        {layers.map((layer) => {
          const on = enabled.includes(layer.id);
          const status = on ? statusText(statuses[layer.id]) : null;
          return (
            <li key={layer.id} className="layer-item">
              <div className="layer-row">
                <label className="layer-toggle">
                  <input type="checkbox" checked={on} onChange={() => onToggle(layer.id)} aria-label={layer.title} />
                  <span className="layer-swatch" style={{ backgroundColor: layer.color }} />
                  <span className="layer-title">{layer.title}</span>
                </label>
                {layer.settings && layer.settings.length > 0 && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Settings for ${layer.title} layer`}
                    aria-expanded={openSettings === layer.id}
                    onClick={() => setOpenSettings((current) => (current === layer.id ? null : layer.id))}
                  >
                    ⚙️
                  </button>
                )}
              </div>
              {status && <div className={status.error ? 'layer-status layer-status-error' : 'layer-status'}>{status.text}</div>}
              {openSettings === layer.id && (
                <div className="layer-settings">
                  {(layer.settings ?? []).map((definition) => (
                    <SettingField
                      key={definition.id}
                      idPrefix={`layer-${layer.id}-setting-${definition.id}`}
                      definition={definition}
                      values={settings[layer.id] ?? {}}
                      onChangeSetting={(key, value) => onChangeSetting(layer.id, key, value)}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {surface && (
        <div className="layer-earth-style">
          <SelectField {...surface} />
        </div>
      )}
    </div>
  );
}
