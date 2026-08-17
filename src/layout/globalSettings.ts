export const GLOBAL_SETTINGS_STORAGE_KEY = 'space-radar:global-settings:v1';

export const LABEL_SCALE_MIN = 0.5;
export const LABEL_SCALE_MAX = 2.5;
export const LABEL_SCALE_STEP = 0.1;

export const ROTATE_SPEED_MIN = 0;
export const ROTATE_SPEED_MAX = 3;
export const ROTATE_SPEED_STEP = 0.1;

export type CardDensity = 'comfortable' | 'compact' | 'large';

/** Grid row height in pixels for each density — see GridLayout's `rowHeight`. */
export const DENSITY_ROW_HEIGHT: Record<CardDensity, number> = {
  comfortable: 160,
  compact: 120,
  large: 220,
};

// Ordered by increasing row height (see DENSITY_ROW_HEIGHT), not alphabetically.
export const DENSITY_OPTIONS: { value: CardDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'large', label: 'Large' },
];

export interface GlobalSettings {
  /** Multiplies the on-screen pixel size of every label/marker on the
   * Earth-globe cards. Stored per-browser (localStorage), so desktop and
   * mobile naturally keep independent values with no viewport-based
   * branching needed. */
  labelScale: number;
  /** Multiplies the five Earth-globe cards' idle auto-rotate speed
   * (earthScene.ts's AUTO_ROTATE_SPEED). 0 stops the spin entirely — no
   * separate on/off toggle needed, since OrbitControls' per-frame rotation
   * delta is directly proportional to this and a zero delta is a no-op. */
  rotateSpeed: number;
  /** Grid row height preset, applied to every card (see GridLayout). */
  density: CardDensity;
}

export const defaultGlobalSettings: GlobalSettings = { labelScale: 1, rotateSpeed: 1, density: 'comfortable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCardDensity(value: unknown): value is CardDensity {
  return value === 'comfortable' || value === 'compact' || value === 'large';
}

export function sanitizeGlobalSettings(raw: unknown): GlobalSettings {
  if (!isRecord(raw)) {
    return { ...defaultGlobalSettings };
  }
  const labelScale =
    typeof raw.labelScale === 'number' && Number.isFinite(raw.labelScale)
      ? Math.min(LABEL_SCALE_MAX, Math.max(LABEL_SCALE_MIN, raw.labelScale))
      : defaultGlobalSettings.labelScale;
  const rotateSpeed =
    typeof raw.rotateSpeed === 'number' && Number.isFinite(raw.rotateSpeed)
      ? Math.min(ROTATE_SPEED_MAX, Math.max(ROTATE_SPEED_MIN, raw.rotateSpeed))
      : defaultGlobalSettings.rotateSpeed;
  const density = isCardDensity(raw.density) ? raw.density : defaultGlobalSettings.density;
  return { labelScale, rotateSpeed, density };
}
