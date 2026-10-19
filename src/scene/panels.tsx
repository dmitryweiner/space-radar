import type { ComponentType } from 'react';
import type { CardComponentProps, CardSettingValues } from '../settings/types';
import { KpIndexCard } from '../cards/KpIndexCard';
import { SolarWindCard } from '../cards/SolarWindCard';
import { LaunchesCard } from '../cards/LaunchesCard';
import { SolarFlaresCard } from '../cards/SolarFlaresCard';
import { AuroraForecastCard } from '../cards/AuroraForecastCard';
import { MoonCard } from '../cards/MoonCard';
import { ApodCard } from '../cards/ApodCard';
import { AsteroidsCard } from '../cards/AsteroidsCard';
import { EpicCard } from '../cards/EpicCard';
import { SolarCycleCard } from '../cards/SolarCycleCard';
import { SolarImageryCard } from '../cards/SolarImageryCard';
import { NasaImagesCard } from '../cards/NasaImagesCard';
import { useNoaaScales, usePeopleInSpace } from '../hooks/sharedResources';
import { formatTime } from '../format/display';

// Detail panels the inspector can open (from a status-bar chip or the widget
// menu). Most are the self-contained components in src/cards/.

function ScalesPanel() {
  const { data, loading, error } = useNoaaScales();
  if (loading) return <p className="card-status">Loading…</p>;
  if (error || !data) return <p className="card-status card-status-error">{error ?? 'No data.'}</p>;
  const rows = [
    { key: 'R', value: data.r, name: 'Radio blackouts', cause: 'X-ray flares degrade HF radio on the dayside.' },
    { key: 'S', value: data.s, name: 'Solar radiation storms', cause: 'Energetic protons — a risk to astronauts and satellites.' },
    { key: 'G', value: data.g, name: 'Geomagnetic storms', cause: 'CME/solar-wind driven; G1+ brings aurorae to lower latitudes.' },
  ];
  return (
    <div className="scales-panel">
      {rows.map((row) => (
        <div key={row.key} className="scales-row">
          <span className="scales-badge">
            {row.key}
            {row.value}
          </span>
          <div>
            <div className="scales-name">{row.name}</div>
            <div className="scales-cause">{row.cause}</div>
          </div>
        </div>
      ))}
      <p className="card-status">
        NOAA scales run 0 (none) to 5 (extreme). Observed {formatTime(data.observedAt)}.{' '}
        <a className="detail-link" href="https://www.swpc.noaa.gov/noaa-scales-explanation" target="_blank" rel="noreferrer">
          About the scales ↗
        </a>
      </p>
    </div>
  );
}

function PeoplePanel() {
  const { data, loading, error } = usePeopleInSpace();
  if (loading) return <p className="card-status">Loading…</p>;
  if (error || !data) return <p className="card-status card-status-error">{error ?? 'No data.'}</p>;
  return (
    <div>
      <p className="card-status">{data.count} people are in space right now.</p>
      <ul className="people-list">
        {data.people.map((person) => (
          <li key={person.name}>
            {person.name}
            {person.agency && <span className="people-agency"> · {person.agency}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type InspectorPanelId =
  | 'scales'
  | 'kp'
  | 'wind'
  | 'people'
  | 'launches'
  | 'flares'
  | 'aurora-forecast'
  | 'moon'
  | 'apod'
  | 'asteroids'
  | 'epic'
  | 'solar-cycle'
  | 'sun-images'
  | 'nasa-images';

export interface InspectorPanel {
  id: InspectorPanelId;
  title: string;
  component: ComponentType<CardComponentProps>;
  settings?: CardSettingValues;
}

export const INSPECTOR_PANELS: InspectorPanel[] = [
  { id: 'scales', title: 'Space weather scales', component: ScalesPanel },
  { id: 'kp', title: 'Geomagnetic activity (Kp)', component: KpIndexCard, settings: { barCount: 16 } },
  { id: 'wind', title: 'Solar wind', component: SolarWindCard },
  { id: 'people', title: 'People in space', component: PeoplePanel },
  { id: 'launches', title: 'Upcoming launches', component: LaunchesCard },
  { id: 'flares', title: 'Solar flares & CMEs', component: SolarFlaresCard },
  { id: 'aurora-forecast', title: 'Aurora forecast', component: AuroraForecastCard },
  { id: 'moon', title: 'Moon & eclipses', component: MoonCard },
  { id: 'apod', title: 'Astronomy Picture of the Day', component: ApodCard },
  { id: 'asteroids', title: "Today's near-Earth asteroids", component: AsteroidsCard },
  { id: 'epic', title: 'Earth from L1 (EPIC)', component: EpicCard },
  { id: 'solar-cycle', title: 'Solar cycle', component: SolarCycleCard },
  { id: 'sun-images', title: 'The Sun in other wavelengths', component: SolarImageryCard, settings: { layers: ['0171', '0304', 'HMIIF', 'HMIB'] } },
  { id: 'nasa-images', title: 'NASA image library', component: NasaImagesCard },
];

// Panels about the Sun itself: shown on the Sun tab's stage rather than in
// the inspector's "More" list. (Kp, the NOAA scales and the aurora forecast
// are Earth's response, so they stay in the inspector.)
export const SUN_PANELS: InspectorPanelId[] = ['flares', 'wind', 'solar-cycle', 'sun-images'];

export function panelById(id: InspectorPanelId): InspectorPanel | undefined {
  return INSPECTOR_PANELS.find((panel) => panel.id === id);
}
