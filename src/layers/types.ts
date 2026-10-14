import type { SceneVector3 } from '../astro/coords';
import type { AuroraPoint, FirePoint, GlobeMarker, GlobeTrack, MarkerHit, NamedPosition } from '../render/earthScene';
import type { CardSettingDefinition, CardSettingValues } from '../layout/types';

// A "layer" is one geographic data source drawn on the Earth globe — the data
// half of what used to be a whole globe card. The same layer feeds both the
// dashboard's single-layer globe card (GlobeLayerCard) and the Scene view,
// where every enabled layer shares one globe.

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

export interface LayerState {
  frame: LayerFrame;
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

export interface LayerDefinition {
  id: string;
  title: string;
  /** CSS colour for the layer's chip/legend swatch in the Scene view. */
  color: string;
  settings?: CardSettingDefinition[];
  /** A React hook — always called unconditionally by its host component. */
  useLayer(settings: CardSettingValues, time: LayerTime): LayerState;
}

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
