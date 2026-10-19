export const GLOBAL_SETTINGS_STORAGE_KEY = 'space-radar:global-settings:v1';

export const LABEL_SCALE_MIN = 0.5;
export const LABEL_SCALE_MAX = 2.5;
export const LABEL_SCALE_STEP = 0.1;

export const ROTATE_SPEED_MIN = 0;
export const ROTATE_SPEED_MAX = 3;
export const ROTATE_SPEED_STEP = 0.1;

export type TimeZoneSetting = 'utc' | 'local';
export type UnitSystem = 'metric' | 'imperial';
export type StartScene = 'last' | 'earth' | 'sun' | 'solar-system';

export const TIME_ZONE_OPTIONS: { value: TimeZoneSetting; label: string }[] = [
  { value: 'utc', label: 'UTC' },
  { value: 'local', label: 'Local time' },
];
export const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Kilometres' },
  { value: 'imperial', label: 'Miles' },
];
export const START_SCENE_OPTIONS: { value: StartScene; label: string }[] = [
  { value: 'last', label: 'Last used' },
  { value: 'earth', label: 'Earth' },
  { value: 'sun', label: 'Sun' },
  { value: 'solar-system', label: 'Solar System' },
];

export interface GlobalSettings {
  /** Multiplies the on-screen pixel size of every label/marker on the
   * Earth globe and in the Solar System scene. Stored per-browser
   * (localStorage), so desktop and mobile naturally keep independent values
   * with no viewport-based branching needed. */
  labelScale: number;
  /** Multiplies the Earth globe's idle auto-rotate speed
   * (earthScene.ts's AUTO_ROTATE_SPEED). 0 stops the spin entirely — no
   * separate on/off toggle needed, since OrbitControls' per-frame rotation
   * delta is directly proportional to this and a zero delta is a no-op. */
  rotateSpeed: number;
  /** How times are shown (src/format/display.ts). */
  timeZone: TimeZoneSetting;
  /** Distances and speeds in km or miles; AU stays AU. */
  units: UnitSystem;
  /** Which scene tab the app opens on. */
  startScene: StartScene;
  /** Fewer API polls, smaller images, 30 fps / 1× pixel ratio rendering. */
  dataSaver: boolean;
}

export const defaultGlobalSettings: GlobalSettings = {
  labelScale: 1,
  rotateSpeed: 1,
  timeZone: 'utc',
  units: 'metric',
  startScene: 'last',
  dataSaver: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clampedNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function oneOf<T extends string>(value: unknown, options: { value: T }[], fallback: T): T {
  return options.find((option) => option.value === value)?.value ?? fallback;
}

export function sanitizeGlobalSettings(raw: unknown): GlobalSettings {
  if (!isRecord(raw)) {
    return { ...defaultGlobalSettings };
  }
  const d = defaultGlobalSettings;
  return {
    labelScale: clampedNumber(raw.labelScale, LABEL_SCALE_MIN, LABEL_SCALE_MAX, d.labelScale),
    rotateSpeed: clampedNumber(raw.rotateSpeed, ROTATE_SPEED_MIN, ROTATE_SPEED_MAX, d.rotateSpeed),
    timeZone: oneOf(raw.timeZone, TIME_ZONE_OPTIONS, d.timeZone),
    units: oneOf(raw.units, UNIT_OPTIONS, d.units),
    startScene: oneOf(raw.startScene, START_SCENE_OPTIONS, d.startScene),
    dataSaver: typeof raw.dataSaver === 'boolean' ? raw.dataSaver : d.dataSaver,
  };
}
