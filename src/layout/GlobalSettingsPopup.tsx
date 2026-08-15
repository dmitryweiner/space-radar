import { LABEL_SCALE_MAX, LABEL_SCALE_MIN, LABEL_SCALE_STEP, type GlobalSettings } from './globalSettings';
import { NumberField } from './NumberField';

interface GlobalSettingsPopupProps {
  settings: GlobalSettings;
  onChangeLabelScale: (value: number) => void;
  onClose: () => void;
}

export function GlobalSettingsPopup({ settings, onChangeLabelScale, onClose }: GlobalSettingsPopupProps) {
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
          <button type="button" className="card-shell-action" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <NumberField
          id="global-setting-label-scale"
          label="Globe label size"
          value={settings.labelScale}
          min={LABEL_SCALE_MIN}
          max={LABEL_SCALE_MAX}
          step={LABEL_SCALE_STEP}
          onChange={onChangeLabelScale}
        />
      </div>
    </div>
  );
}
