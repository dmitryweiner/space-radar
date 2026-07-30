import { IssGlobeCard } from '../cards/IssGlobeCard';
import { SolarSystemCard } from '../cards/SolarSystemCard';
import { KpIndexCard } from '../cards/KpIndexCard';
import { SolarWindCard } from '../cards/SolarWindCard';
import { AuroraForecastCard } from '../cards/AuroraForecastCard';
import { SolarFlaresCard } from '../cards/SolarFlaresCard';
import { AsteroidsCard } from '../cards/AsteroidsCard';
import type { CardDefinition } from './types';

export const cardRegistry: CardDefinition[] = [
  {
    id: 'iss-globe',
    title: 'ISS & Satellites',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    component: IssGlobeCard,
  },
  {
    id: 'solar-system',
    title: 'Solar System',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    component: SolarSystemCard,
  },
  {
    id: 'kp-index',
    title: 'Geomagnetic Activity (Kp-index)',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 2, w: 1, h: 1 },
    component: KpIndexCard,
  },
  {
    id: 'solar-wind',
    title: 'Solar Wind',
    defaultVisible: true,
    defaultLayout: { x: 1, y: 2, w: 1, h: 1 },
    component: SolarWindCard,
  },
  {
    id: 'aurora-forecast',
    title: 'Aurora Forecast',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 3, w: 2, h: 2, minW: 2, minH: 2 },
    component: AuroraForecastCard,
  },
  {
    id: 'solar-flares',
    title: 'Solar Flares & CME',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 3, w: 1, h: 2 },
    component: SolarFlaresCard,
  },
  {
    id: 'asteroids',
    title: 'Near-Earth Asteroids',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 5, w: 2, h: 1 },
    component: AsteroidsCard,
  },
];
