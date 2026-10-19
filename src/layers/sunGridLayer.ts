import type { SunLayerDefinition } from './types';

const FRAME = { grid: true };

// Heliographic latitude/longitude lines every 15°, tilted by B0 — makes the
// region/flare positions (and solar rotation) readable.
export const sunGridLayer: SunLayerDefinition = {
  id: 'sun-grid',
  title: 'Coordinate grid',
  color: '#8a94b8',
  useLayer() {
    return { frame: FRAME, loading: false, error: null, summary: null, legend: [], describe: () => null };
  },
};
