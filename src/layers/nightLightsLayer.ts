import { useMemo } from 'react';
import { GIBS_NIGHT_LIGHTS_URL } from '../api/gibs';
import type { LayerDefinition } from './types';

// City lights on the night side (NASA GIBS VIIRS Black Marble). Follows the
// real terminator, so scrubbing time sweeps the lights around the globe.
export const nightLightsLayer: LayerDefinition = {
  id: 'night-lights',
  title: 'Night lights',
  color: '#ffd27a',
  useLayer() {
    const frame = useMemo(() => ({ nightLights: GIBS_NIGHT_LIGHTS_URL }), []);
    return {
      frame,
      loading: false,
      error: null,
      summary: null,
      legend: [{ label: 'City lights (VIIRS Black Marble)', color: '#ffd27a' }],
      describe: () => null,
    };
  },
};
