// The SDO channels the Sun tab can show. Plain <img> sources (no CORS/key);
// SDO refreshes each one every ~15 min. The data-saver setting swaps in the
// 512 px rendition — overlays are placed in image fractions, so either works.

export interface SunChannel {
  value: string;
  label: string;
  /** One line on what this channel shows. */
  hint: string;
  /**
   * Plate scale of SDO's 1024 px "latest" image, arcsec per pixel: AIA's
   * 0.6″/px and HMI's 0.504″/px at 4096 px, ×4. Measured against the images:
   * HMI's limb sits at 478 px from centre, = 963″ / 2.016 exactly.
   */
  arcsecPerPx1024: number;
}

const AIA = 2.4;
const HMI = 2.016;

export const SUN_CHANNELS: SunChannel[] = [
  { value: '0193', label: 'Corona · 193 Å', hint: 'Active regions glow; coronal holes are the dark patches.', arcsecPerPx1024: AIA },
  { value: '0171', label: 'Quiet corona · 171 Å', hint: 'Magnetic loops arching over active regions.', arcsecPerPx1024: AIA },
  { value: '0304', label: 'Chromosphere · 304 Å', hint: 'Filaments (dark threads) and prominences at the limb.', arcsecPerPx1024: AIA },
  { value: '0131', label: 'Flare plasma · 131 Å', hint: 'The hottest material — flares light up here first.', arcsecPerPx1024: AIA },
  { value: 'HMIIF', label: 'Visible light', hint: 'The photosphere: sunspots as you would see them through a filter.', arcsecPerPx1024: HMI },
  { value: 'HMIB', label: 'Magnetogram', hint: 'Magnetic polarity: white and black are opposite poles.', arcsecPerPx1024: HMI },
];

export function sunChannel(value: string): SunChannel {
  return SUN_CHANNELS.find((channel) => channel.value === value) ?? SUN_CHANNELS[0];
}

export function sunImageUrl(value: string, small: boolean): string {
  return `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_${small ? 512 : 1024}_${value}.jpg`;
}

/** The solar disk's radius as a fraction of the image's half-width. */
export function diskRadiusFraction(channel: SunChannel, angularRadiusArcsec: number): number {
  return angularRadiusArcsec / (channel.arcsecPerPx1024 * 512);
}
