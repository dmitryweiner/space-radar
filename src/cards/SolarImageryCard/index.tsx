import { useEffect, useState } from 'react';
import type { CardComponentProps } from '../../layout/types';
import { listSetting } from '../../layout/layoutState';

const REFRESH_MS = 15 * 60 * 1000;

interface ImageryLayer {
  value: string;
  label: string;
  url: string;
}

// Direct <img> sources — no CORS/key needed. SDO publishes a fresh full-disk
// image every ~15 min per wavelength; GOES-19 gives a live Earth full disk.
const SDO_BASE = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_';

export const SOLAR_IMAGERY_LAYERS: ImageryLayer[] = [
  { value: '0193', label: 'Corona 193Å', url: `${SDO_BASE}0193.jpg` },
  { value: '0171', label: 'Corona 171Å', url: `${SDO_BASE}0171.jpg` },
  { value: '0304', label: 'Chromosphere 304Å', url: `${SDO_BASE}0304.jpg` },
  { value: '0131', label: 'Flares 131Å', url: `${SDO_BASE}0131.jpg` },
  { value: 'HMIIF', label: 'Sunspots (visible)', url: `${SDO_BASE}HMIIF.jpg` },
  { value: 'HMIB', label: 'Magnetogram', url: `${SDO_BASE}HMIB.jpg` },
  { value: 'GOES19', label: 'Earth (GOES-19)', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg' },
];

const LAYERS_BY_VALUE = new Map(SOLAR_IMAGERY_LAYERS.map((layer) => [layer.value, layer]));

export function SolarImageryCard({ settings = {} }: CardComponentProps) {
  const selected = listSetting(settings, 'layers', ['0193']);
  const [cacheBust, setCacheBust] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCacheBust(Date.now()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const layers = selected
    .map((value) => LAYERS_BY_VALUE.get(value))
    .filter((layer): layer is ImageryLayer => layer !== undefined);

  if (layers.length === 0) {
    return <p className="card-status">Select a wavelength in the card settings.</p>;
  }

  return (
    <div className="solar-imagery-card">
      <div className="solar-imagery-grid">
        {layers.map((layer) => (
          <figure key={layer.value} className="solar-imagery-item">
            <img src={`${layer.url}?t=${cacheBust}`} alt={layer.label} className="solar-imagery-img" loading="lazy" />
            <figcaption className="solar-imagery-caption">{layer.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="chart-status-line">Sources: NASA SDO · NOAA GOES-19</p>
    </div>
  );
}
