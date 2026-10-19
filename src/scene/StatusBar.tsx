import { useEffect, useState } from 'react';
import { useKpIndex, useLaunches, useNoaaScales, usePeopleInSpace, useSolarWind } from '../hooks/sharedResources';
import type { InspectorPanelId } from './panels';
import { formatSpeed } from '../format/display';

// The "at a glance" strip: the handful of numbers worth seeing without opening
// anything. Each chip opens its detail panel in the inspector.

function scaleColor(level: number): string {
  if (level >= 4) return 'var(--status-critical)';
  if (level >= 2) return 'var(--status-serious)';
  if (level >= 1) return 'var(--status-warning)';
  return 'var(--status-good)';
}

function kpColor(kp: number): string {
  if (kp >= 7) return 'var(--status-critical)';
  if (kp >= 5) return 'var(--status-serious)';
  if (kp >= 4) return 'var(--status-warning)';
  return 'var(--status-good)';
}

function countdown(ms: number): string {
  if (ms <= 0) return 'now';
  const hours = ms / 3_600_000;
  if (hours < 1) return `in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `in ${Math.round(hours)} h`;
  return `in ${Math.round(hours / 24)} d`;
}

// Shown when a source failed; the chip's tooltip carries the error.
const UNAVAILABLE = 'n/a';

interface ChipProps {
  label: string;
  value: string;
  color?: string;
  title?: string;
  onClick: () => void;
}

function Chip({ label, value, color, title, onClick }: ChipProps) {
  const unavailable = value === UNAVAILABLE;
  return (
    <button type="button" className={unavailable ? 'status-chip status-chip-unavailable' : 'status-chip'} onClick={onClick} title={title}>
      {color && <span className="status-chip-dot" style={{ backgroundColor: color }} />}
      <span className="status-chip-label">{label}</span>
      <span className="status-chip-value">{value}</span>
    </button>
  );
}

export function StatusBar({ onOpen }: { onOpen: (panel: InspectorPanelId) => void }) {
  const kp = useKpIndex();
  const wind = useSolarWind();
  const scales = useNoaaScales();
  const people = usePeopleInSpace();
  const launches = useLaunches();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const latestKp = kp.data && kp.data.length > 0 ? kp.data[kp.data.length - 1].kp : null;
  const latestSpeed = wind.data ? ([...wind.data].reverse().find((p) => p.speed !== null)?.speed ?? null) : null;
  const nextLaunch = launches.data?.find((launch) => Date.parse(launch.net) > now) ?? null;
  const dash = '—';

  return (
    <div className="status-bar" data-testid="status-bar">
      {scales.data ? (
        <>
          <Chip label="R" value={String(scales.data.r)} color={scaleColor(scales.data.r)} title="NOAA radio blackout scale (0–5)" onClick={() => onOpen('scales')} />
          <Chip label="S" value={String(scales.data.s)} color={scaleColor(scales.data.s)} title="NOAA solar radiation storm scale (0–5)" onClick={() => onOpen('scales')} />
          <Chip label="G" value={String(scales.data.g)} color={scaleColor(scales.data.g)} title="NOAA geomagnetic storm scale (0–5)" onClick={() => onOpen('scales')} />
        </>
      ) : (
        <Chip label="NOAA R/S/G" value={scales.error ? UNAVAILABLE : dash} title={scales.error ?? undefined} onClick={() => onOpen('scales')} />
      )}
      <Chip
        label="Kp"
        value={latestKp !== null ? latestKp.toFixed(1) : kp.error ? UNAVAILABLE : dash}
        color={latestKp !== null ? kpColor(latestKp) : undefined}
        title={kp.error ?? 'Planetary K-index'}
        onClick={() => onOpen('kp')}
      />
      <Chip
        label="Wind"
        value={latestSpeed !== null ? formatSpeed(latestSpeed, 0) : wind.error ? UNAVAILABLE : dash}
        title={wind.error ?? 'Solar wind speed at L1'}
        onClick={() => onOpen('wind')}
      />
      <Chip
        label="In space"
        value={people.data ? `${people.data.count} people` : people.error ? UNAVAILABLE : dash}
        title={people.error ?? 'People in orbit right now'}
        onClick={() => onOpen('people')}
      />
      <Chip
        label="Next launch"
        value={nextLaunch ? countdown(Date.parse(nextLaunch.net) - now) : launches.error ? UNAVAILABLE : dash}
        title={nextLaunch?.name ?? launches.error ?? undefined}
        onClick={() => onOpen('launches')}
      />
    </div>
  );
}
