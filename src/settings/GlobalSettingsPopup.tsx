import {
  LABEL_SCALE_MAX,
  LABEL_SCALE_MIN,
  LABEL_SCALE_STEP,
  ROTATE_SPEED_MAX,
  ROTATE_SPEED_MIN,
  ROTATE_SPEED_STEP,
  type GlobalSettings,
} from './globalSettings';
import { SliderField } from './SliderField';

interface GlobalSettingsPopupProps {
  settings: GlobalSettings;
  onChangeLabelScale: (value: number) => void;
  onChangeRotateSpeed: (value: number) => void;
  onClose: () => void;
}

export function GlobalSettingsPopup({
  settings,
  onChangeLabelScale,
  onChangeRotateSpeed,
  onClose,
}: GlobalSettingsPopupProps) {
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
          label="Globe label size"
          value={settings.labelScale}
          min={LABEL_SCALE_MIN}
          max={LABEL_SCALE_MAX}
          step={LABEL_SCALE_STEP}
          onChange={onChangeLabelScale}
        />
        <SliderField
          id="global-setting-rotate-speed"
          label="Auto-rotate speed (0 = off)"
          value={settings.rotateSpeed}
          min={ROTATE_SPEED_MIN}
          max={ROTATE_SPEED_MAX}
          step={ROTATE_SPEED_STEP}
          onChange={onChangeRotateSpeed}
        />
      </div>
    </div>
  );
}
