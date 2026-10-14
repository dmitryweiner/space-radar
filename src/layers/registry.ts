import { issLayer } from './issLayer';
import { eonetLayer } from './eonetLayer';
import { quakesLayer } from './quakesLayer';
import { firesLayer } from './firesLayer';
import { auroraLayer } from './auroraLayer';
import { neoFlybyLayer } from './neoFlybyLayer';
import { fireballsLayer } from './fireballsLayer';
import { nightLightsLayer } from './nightLightsLayer';
import type { LayerDefinition } from './types';

/** Every layer the Scene view's Earth globe can show, in panel order. */
export const earthLayers: LayerDefinition[] = [
  issLayer,
  auroraLayer,
  quakesLayer,
  eonetLayer,
  firesLayer,
  neoFlybyLayer,
  fireballsLayer,
  nightLightsLayer,
];

/** On for a first-time visitor. Fires are heavy (thousands of points). */
export const DEFAULT_ENABLED_LAYERS = ['iss', 'aurora', 'quakes', 'eonet', 'night-lights'];
