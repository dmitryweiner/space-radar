import { useEffect, useState } from 'react';
import { auroraForecastImageUrl } from '../../api/swpc';

const REFRESH_MS = 15 * 60 * 1000;

export function AuroraForecastCard() {
  const [cacheBust, setCacheBust] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCacheBust(Date.now()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="aurora-card">
      <img
        src={`${auroraForecastImageUrl()}?t=${cacheBust}`}
        alt="NOAA OVATION aurora forecast for the northern hemisphere"
        className="aurora-image"
      />
      <p className="chart-status-line">Source: NOAA SWPC OVATION model</p>
    </div>
  );
}
