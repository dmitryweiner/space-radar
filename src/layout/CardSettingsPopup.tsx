import type { CardDefinition, CardLayoutRect, CardSettingValue, CardSettingValues } from './types';
import { GRID_COLS } from './GridLayout';
import { NumberField } from './NumberField';
import { SettingField } from './SettingField';

const MAX_ROWS = 8;

interface CardSettingsPopupProps {
  card: CardDefinition;
  rect: CardLayoutRect;
  values: CardSettingValues;
  onResize: (w: number, h: number) => void;
  onChangeSetting: (id: string, value: CardSettingValue) => void;
  onClose: () => void;
}

export function CardSettingsPopup({ card, rect, values, onResize, onChangeSetting, onClose }: CardSettingsPopupProps) {
  return (
    <div className="settings-backdrop" data-testid="card-settings-popup" onClick={onClose}>
      <div
        className="settings-popup"
        role="dialog"
        aria-label={`Settings for ${card.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-popup-header">
          <span className="settings-popup-title">{card.title}</span>
          <button type="button" className="card-shell-action" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>
        <NumberField
          id={`${card.id}-setting-w`}
          label="Width (columns)"
          value={rect.w}
          min={card.defaultLayout.minW ?? 1}
          max={card.defaultLayout.maxW ?? GRID_COLS}
          onChange={(w) => onResize(w, rect.h)}
        />
        <NumberField
          id={`${card.id}-setting-h`}
          label="Height (rows)"
          value={rect.h}
          min={card.defaultLayout.minH ?? 1}
          max={card.defaultLayout.maxH ?? MAX_ROWS}
          onChange={(h) => onResize(rect.w, h)}
        />
        {(card.settings ?? []).map((definition) => (
          <SettingField
            key={definition.id}
            idPrefix={`${card.id}-setting-${definition.id}`}
            definition={definition}
            values={values}
            onChangeSetting={onChangeSetting}
          />
        ))}
      </div>
    </div>
  );
}
