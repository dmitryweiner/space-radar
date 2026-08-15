export const GLOBAL_SETTINGS_STORAGE_KEY = 'space-radar:global-settings:v1';

export const LABEL_SCALE_MIN = 0.5;
export const LABEL_SCALE_MAX = 2.5;
export const LABEL_SCALE_STEP = 0.1;

export interface GlobalSettings {
  /** Multiplies the on-screen pixel size of every label/marker on the
   * Earth-globe cards. Stored per-browser (localStorage), so desktop and
   * mobile naturally keep independent values with no viewport-based
   * branching needed. */
  labelScale: number;
}

export const defaultGlobalSettings: GlobalSettings = { labelScale: 1 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeGlobalSettings(raw: unknown): GlobalSettings {
  if (!isRecord(raw) || typeof raw.labelScale !== 'number' || !Number.isFinite(raw.labelScale)) {
    return { ...defaultGlobalSettings };
  }
  return { labelScale: Math.min(LABEL_SCALE_MAX, Math.max(LABEL_SCALE_MIN, raw.labelScale)) };
}
