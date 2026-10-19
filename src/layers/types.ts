import type { SceneVector3 } from '../astro/coords';
import type { AuroraPoint, FirePoint, GlobeMarker, GlobeTrack, MarkerHit, NamedPosition } from '../render/earthScene';
import type { SolarMarker, SolarTrack } from '../render/solarSystemScene';
import type { CardSettingDefinition, CardSettingValues } from '../settings/types';

// A "layer" is one data source drawn in a scene: on the Earth globe (frame =
// LayerFrame) or in the Solar System (frame = SolarFrame). Every enabled
// layer of a scene shares that scene's single canvas.

/** What a layer wants drawn right now. Absent fields = leave untouched. */
export interface LayerFrame {
  iss?: { position: SceneVector3; trail: SceneVector3[] } | null;
  satellites?: NamedPosition[];
  markers?: GlobeMarker[];
  firePoints?: FirePoint[];
  auroraPoints?: AuroraPoint[];
  tracks?: GlobeTrack[];
  /** City-lights texture URL for the night side; null clears it. */
  nightLights?: string | null;
}

export interface LegendItem {
  label: string;
  /** CSS colour. */
  color: string;
}

export interface MarkerDetails {
  title: string;
  fields: { label: string; value: string }[];
  detailUrl?: string | null;
}

/** What a Solar System layer wants drawn (heliocentric, true distances). */
export interface SolarFrame {
  markers?: SolarMarker[];
  tracks?: SolarTrack[];
}

/** A point of interest on the solar disk (Sun tab). */
export interface SunMarker {
  id: string;
  /** Stonyhurst position *now* (already rotated to the current time). */
  latDeg: number;
  lonDeg: number;
  /** CSS colour. */
  color: string;
  shape: 'ring' | 'star';
  /** On-screen size in CSS px (before the label-scale setting). */
  sizePx: number;
  label?: string;
  /** Which side of the mark the label sits (default right) — flares go left
   * so they don't cover their region's label. */
  labelSide?: 'left' | 'right';
}

/** What a Sun-tab layer wants drawn over the solar disk. */
export interface SunFrame {
  markers?: SunMarker[];
  /** Draw the heliographic latitude/longitude grid. */
  grid?: boolean;
}

export interface LayerState<F = LayerFrame> {
  frame: F;
  loading: boolean;
  error: string | null;
  /** Short one-line status once loaded ("18 satellites", "No aurora…"). */
  summary: string | null;
  legend: LegendItem[];
  /** Details for a clicked marker of this layer, or null if not ours. */
  describe(hit: MarkerHit): MarkerDetails | null;
}

/**
 * The shared time cursor. `null` = live ("now", ticking); a number = a fixed
 * instant in ms picked on the scrubber. Layers whose data is time-dependent
 * (satellites, terminator, flybys) honour it; snapshot feeds ignore it.
 */
export type LayerTime = number | null;

export interface LayerDefinition<F = LayerFrame> {
  id: string;
  title: string;
  /** CSS colour for the layer's chip/legend swatch in the Scene view. */
  color: string;
  settings?: CardSettingDefinition[];
  /** A React hook — always called unconditionally by its host component. */
  useLayer(settings: CardSettingValues, time: LayerTime): LayerState<F>;
}

export type SolarLayerDefinition = LayerDefinition<SolarFrame>;
export type SolarLayerState = LayerState<SolarFrame>;
export type SunLayerDefinition = LayerDefinition<SunFrame>;

/** The part of a layer the panels need (any scene). */
export type LayerInfo = Pick<LayerDefinition, 'id' | 'title' | 'color' | 'settings'>;

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
