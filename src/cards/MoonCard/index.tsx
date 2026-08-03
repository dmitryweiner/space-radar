import { useEffect, useMemo, useState } from 'react';
import { computeMoonInfo } from '../../astro/moonInfo';

const REFRESH_MS = 60 * 1000;
const R = 40;
const CX = 50;
const CY = 50;
const BRIGHT = '#d8dcf0';
const DARK = '#161c30';

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

// Two-shape phase disc: a bright semicircle on the lit side, then a centred
// ellipse (bright for gibbous, dark for crescent) whose width encodes the
// illuminated fraction. Degenerates correctly at new/quarter/full.
function litSemicircle(waxing: boolean): string {
  const sweep = waxing ? 1 : 0;
  return `M ${CX},${CY - R} A ${R} ${R} 0 0 ${sweep} ${CX},${CY + R} Z`;
}

export function MoonCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const info = useMemo(() => computeMoonInfo(now), [now]);

  const gibbous = info.illumination > 0.5;
  const rx = R * Math.abs(2 * info.illumination - 1);
  const ellipseFill = gibbous ? BRIGHT : DARK;
  const illumPct = Math.round(info.illumination * 100);

  return (
    <div className="moon-card">
      <div className="moon-visual">
        <svg viewBox="0 0 100 100" className="moon-svg" role="img" aria-label={`${info.phaseName}, ${illumPct}% illuminated`}>
          <circle cx={CX} cy={CY} r={R} fill={DARK} stroke="#2c3556" strokeWidth={1} />
          <path d={litSemicircle(info.waxing)} fill={BRIGHT} />
          {rx > 0.01 && <ellipse cx={CX} cy={CY} rx={rx} ry={R} fill={ellipseFill} />}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#2c3556" strokeWidth={1} />
        </svg>
        <div className="moon-headline">
          <strong className="moon-phase-name">{info.phaseName}</strong>
          <span className="moon-illum">{illumPct}% illuminated</span>
          <span className="moon-distance">{formatKm(info.currentDistanceKm)} away</span>
        </div>
      </div>
      <dl className="moon-facts">
        <div className="moon-fact">
          <dt>Next perigee</dt>
          <dd>
            {formatDate(info.nextPerigee.date)} · {formatKm(info.nextPerigee.distanceKm)}
          </dd>
        </div>
        <div className="moon-fact">
          <dt>Next apogee</dt>
          <dd>
            {formatDate(info.nextApogee.date)} · {formatKm(info.nextApogee.distanceKm)}
          </dd>
        </div>
        <div className="moon-fact">
          <dt>Next lunar eclipse</dt>
          <dd>
            {formatDate(info.nextLunarEclipse.date)} · {info.nextLunarEclipse.kind}
          </dd>
        </div>
        <div className="moon-fact">
          <dt>Next solar eclipse</dt>
          <dd>
            {formatDate(info.nextSolarEclipse.date)} · {info.nextSolarEclipse.kind}
          </dd>
        </div>
      </dl>
    </div>
  );
}
