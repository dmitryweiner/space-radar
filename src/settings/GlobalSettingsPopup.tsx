import { useState } from 'react';
import {
  LABEL_SCALE_MAX,
  LABEL_SCALE_MIN,
  LABEL_SCALE_STEP,
  ROTATE_SPEED_MAX,
  ROTATE_SPEED_MIN,
  ROTATE_SPEED_STEP,
  START_SCENE_OPTIONS,
  TIME_ZONE_OPTIONS,
  UNIT_OPTIONS,
  type GlobalSettings,
} from './globalSettings';
import { clearAppStorage, updateGlobalSettings } from './useGlobalSettings';
import { SelectField } from './SelectField';
import { SliderField } from './SliderField';

interface GlobalSettingsPopupProps {
  settings: GlobalSettings;
  onClose: () => void;
}

function pick<T extends string>(options: { value: T }[], value: string): T | undefined {
  return options.find((option) => option.value === value)?.value;
}

export function GlobalSettingsPopup({ settings, onClose }: GlobalSettingsPopupProps) {
  // Reset is two taps (no window.confirm — it blocks the page and automation).
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="settings-backdrop" data-testid="global-settings-popup" onClick={onClose}>
      <div
        className="settings-popup"
        role="dialog"
        aria-label="General settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-popup-header">
          <span className="settings-popup-title">General settings</span>
          <button type="button" className="icon-btn" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <SliderField
          id="global-setting-label-scale"
          label="Label size"
          value={settings.labelScale}
          min={LABEL_SCALE_MIN}
          max={LABEL_SCALE_MAX}
          step={LABEL_SCALE_STEP}
          onChange={(labelScale) => updateGlobalSettings({ labelScale })}
        />
        <SliderField
          id="global-setting-rotate-speed"
          label="Auto-rotate speed (0 = off)"
          value={settings.rotateSpeed}
          min={ROTATE_SPEED_MIN}
          max={ROTATE_SPEED_MAX}
          step={ROTATE_SPEED_STEP}
          onChange={(rotateSpeed) => updateGlobalSettings({ rotateSpeed })}
        />
        <SelectField
          idPrefix="global-setting-time-zone"
          label="Times"
          options={TIME_ZONE_OPTIONS}
          value={settings.timeZone}
          onChange={(value) => {
            const timeZone = pick(TIME_ZONE_OPTIONS, value);
            if (timeZone) updateGlobalSettings({ timeZone });
          }}
        />
        <SelectField
          idPrefix="global-setting-units"
          label="Distances & speeds"
          options={UNIT_OPTIONS}
          value={settings.units}
          onChange={(value) => {
            const units = pick(UNIT_OPTIONS, value);
            if (units) updateGlobalSettings({ units });
          }}
        />
        <SelectField
          idPrefix="global-setting-start-scene"
          label="Open on"
          options={START_SCENE_OPTIONS}
          value={settings.startScene}
          onChange={(value) => {
            const startScene = pick(START_SCENE_OPTIONS, value);
            if (startScene) updateGlobalSettings({ startScene });
          }}
        />
        <label className="settings-field settings-toggle" htmlFor="global-setting-data-saver">
          <span>
            Save data &amp; battery
            <span className="settings-hint">Fewer data refreshes, smaller images, 30 fps</span>
          </span>
          <input
            id="global-setting-data-saver"
            type="checkbox"
            checked={settings.dataSaver}
            onChange={(event) => updateGlobalSettings({ dataSaver: event.target.checked })}
          />
        </label>
        <div className="settings-reset">
          {confirmReset ? (
            <>
              <span className="settings-hint">Layers, settings and cached data will be cleared.</span>
              <button
                type="button"
                className="tb-btn settings-reset-confirm"
                onClick={() => {
                  clearAppStorage();
                  window.location.reload();
                }}
              >
                Reset now
              </button>
              <button type="button" className="tb-btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="tb-btn" onClick={() => setConfirmReset(true)}>
              Reset everything…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
