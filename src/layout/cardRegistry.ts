import { IssGlobeCard, SATELLITE_CATEGORIES } from '../cards/IssGlobeCard';
import { SolarSystemCard } from '../cards/SolarSystemCard';
import { KpIndexCard } from '../cards/KpIndexCard';
import { SolarWindCard } from '../cards/SolarWindCard';
import { AuroraForecastCard } from '../cards/AuroraForecastCard';
import { SolarFlaresCard } from '../cards/SolarFlaresCard';
import { AsteroidsCard } from '../cards/AsteroidsCard';
import { NaturalEventsCard } from '../cards/NaturalEventsCard';
import { LaunchesCard } from '../cards/LaunchesCard';
import { ApodCard } from '../cards/ApodCard';
import { FireMapCard } from '../cards/FireMapCard';
import type { CardDefinition } from './types';

export const cardRegistry: CardDefinition[] = [
  {
    id: 'iss-globe',
    title: 'ISS & Satellites',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    component: IssGlobeCard,
    settings: [
      {
        kind: 'multiselect',
        id: 'categories',
        label: 'Satellite groups',
        options: SATELLITE_CATEGORIES,
        defaultValue: ['stations'],
      },
      { kind: 'number', id: 'maxSatellites', label: 'Max satellites', min: 10, max: 300, step: 10, defaultValue: 30 },
    ],
  },
  {
    id: 'solar-system',
    title: 'Solar System',
    defaultVisible: true,
    defaultLayout: { x: 2, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    component: SolarSystemCard,
  },
  {
    id: 'natural-events',
    title: 'Natural Events (EONET)',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 2, w: 2, h: 2, minW: 2, minH: 2 },
    component: NaturalEventsCard,
    settings: [{ kind: 'number', id: 'maxEvents', label: 'Events shown', min: 5, max: 60, step: 5, defaultValue: 25 }],
  },
  {
    id: 'apod',
    title: 'Astronomy Picture of the Day',
    defaultVisible: true,
    defaultLayout: { x: 2, y: 2, w: 2, h: 2 },
    component: ApodCard,
  },
  {
    id: 'launches',
    title: 'Upcoming Launches',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 4, w: 2, h: 2 },
    component: LaunchesCard,
    settings: [{ kind: 'number', id: 'count', label: 'Launches shown', min: 3, max: 20, defaultValue: 8 }],
  },
  {
    id: 'asteroids',
    title: 'Near-Earth Asteroids',
    defaultVisible: true,
    defaultLayout: { x: 2, y: 4, w: 2, h: 2 },
    component: AsteroidsCard,
  },
  // --- Hidden by default; parked below the default two-column block. ---
  {
    id: 'solar-wind',
    title: 'Solar Wind',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
    component: SolarWindCard,
    settings: [{ kind: 'number', id: 'points', label: 'Data points', min: 12, max: 120, step: 12, defaultValue: 48 }],
  },
  {
    id: 'aurora-forecast',
    title: 'Aurora Forecast',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 6, w: 2, h: 2, minW: 2, minH: 2 },
    component: AuroraForecastCard,
  },
  {
    id: 'kp-index',
    title: 'Geomagnetic Activity (Kp-index)',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 8, w: 2, h: 2, minW: 2, minH: 2 },
    component: KpIndexCard,
    settings: [{ kind: 'number', id: 'barCount', label: 'Bars shown', min: 4, max: 24, defaultValue: 8 }],
  },
  {
    id: 'solar-flares',
    title: 'Solar Flares & CME',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 8, w: 2, h: 2, minW: 2, minH: 2 },
    component: SolarFlaresCard,
    settings: [{ kind: 'number', id: 'maxEvents', label: 'Events shown', min: 5, max: 50, step: 5, defaultValue: 30 }],
  },
  {
    id: 'fire-map',
    title: 'Active Fires (FIRMS)',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 10, w: 2, h: 2, minW: 2, minH: 2 },
    component: FireMapCard,
    settings: [{ kind: 'number', id: 'dayRange', label: 'Days back', min: 1, max: 7, defaultValue: 1 }],
  },
];
