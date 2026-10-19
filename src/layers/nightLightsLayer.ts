import { useMemo } from 'react';
import { GIBS_FULL_WIDTH, GIBS_SAVER_WIDTH, gibsNightLightsUrl } from '../api/gibs';
import { useGlobalSettings } from '../settings/useGlobalSettings';
import type { LayerDefinition } from './types';

// City lights on the night side (NASA GIBS VIIRS Black Marble). Follows the
// real terminator, so scrubbing time sweeps the lights around the globe.
export const nightLightsLayer: LayerDefinition = {
  id: 'night-lights',
  title: 'Night lights',
  color: '#ffd27a',
  useLayer() {
    const { dataSaver } = useGlobalSettings();
    const frame = useMemo(
      () => ({ nightLights: gibsNightLightsUrl(dataSaver ? GIBS_SAVER_WIDTH : GIBS_FULL_WIDTH) }),
      [dataSaver],
    );
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
