import { IssGlobeCard } from '../cards/IssGlobeCard';
import { issLayer } from '../layers/issLayer';
import { eonetLayer } from '../layers/eonetLayer';
import { firesLayer } from '../layers/firesLayer';
import { quakesLayer } from '../layers/quakesLayer';
import { auroraLayer } from '../layers/auroraLayer';
import type { LayerDefinition } from '../layers/types';
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
import { EpicCard } from '../cards/EpicCard';
import { QuakesCard } from '../cards/QuakesCard';
import { SolarImageryCard, SOLAR_IMAGERY_LAYERS } from '../cards/SolarImageryCard';
import { SolarCycleCard } from '../cards/SolarCycleCard';
import { MoonCard } from '../cards/MoonCard';
import { AuroraGlobeCard } from '../cards/AuroraGlobeCard';
import { NasaImagesCard } from '../cards/NasaImagesCard';
import { NASA_IMAGE_TOPICS } from '../api/nasaImages';
import type { CardDefinition, CardSettingDefinition } from './types';

// Shared by every Earth-globe card's per-card "Earth style" setting: the
// default photo globe (day/night shading) vs. a flat, evenly-lit political
// map (no shadow hiding markers on the dark side).
const EARTH_STYLE_OPTIONS = [
  { value: 'globe', label: 'Globe (photo, day/night)' },
  { value: 'map', label: 'Flat map (no shadow)' },
  { value: 'satellite', label: 'Satellite (NASA GIBS, ~2 days old)' },
];

const EARTH_STYLE_SETTING: CardSettingDefinition = {
  kind: 'select',
  id: 'earthStyle',
  label: 'Earth style',
  options: EARTH_STYLE_OPTIONS,
  defaultValue: 'globe',
};

// A globe card's settings = its layer's own settings + the card-level Earth
// style (in the Scene view Earth style is one global choice instead).
function globeSettings(layer: LayerDefinition): CardSettingDefinition[] {
  return [...(layer.settings ?? []), EARTH_STYLE_SETTING];
}

export const cardRegistry: CardDefinition[] = [
  {
    id: 'iss-globe',
    title: 'ISS & Satellites',
    defaultVisible: true,
    defaultLayout: { x: 0, y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    component: IssGlobeCard,
    settings: globeSettings(issLayer),
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
    settings: globeSettings(eonetLayer),
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
    settings: globeSettings(firesLayer),
  },
  {
    id: 'epic',
    title: 'Earth from L1 (EPIC)',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 10, w: 2, h: 2 },
    component: EpicCard,
    settings: [{ kind: 'number', id: 'frameSeconds', label: 'Seconds / frame', min: 1, max: 10, defaultValue: 2 }],
  },
  {
    id: 'quakes',
    title: 'Earthquakes (USGS)',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 12, w: 2, h: 2, minW: 2, minH: 2 },
    component: QuakesCard,
    settings: globeSettings(quakesLayer),
  },
  {
    id: 'solar-imagery',
    title: 'Live Sun (SDO)',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 12, w: 2, h: 2 },
    component: SolarImageryCard,
    settings: [
      {
        kind: 'multiselect',
        id: 'layers',
        label: 'Wavelengths',
        options: SOLAR_IMAGERY_LAYERS.map((layer) => ({ value: layer.value, label: layer.label })),
        defaultValue: ['0193'],
      },
    ],
  },
  {
    id: 'solar-cycle',
    title: 'Solar Cycle',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 14, w: 2, h: 2 },
    component: SolarCycleCard,
    settings: [{ kind: 'number', id: 'years', label: 'Years shown', min: 5, max: 30, defaultValue: 14 }],
  },
  {
    id: 'moon',
    title: 'Moon & Eclipses',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 14, w: 2, h: 2 },
    component: MoonCard,
  },
  {
    id: 'aurora-globe',
    title: 'Aurora Oval (3D)',
    defaultVisible: false,
    defaultLayout: { x: 0, y: 16, w: 2, h: 2, minW: 2, minH: 2 },
    component: AuroraGlobeCard,
    settings: globeSettings(auroraLayer),
  },
  {
    id: 'nasa-images',
    title: 'NASA Image Library',
    defaultVisible: false,
    defaultLayout: { x: 2, y: 16, w: 2, h: 2 },
    component: NasaImagesCard,
    settings: [
      {
        kind: 'multiselect',
        id: 'topics',
        label: 'Topics',
        options: NASA_IMAGE_TOPICS.map((topic) => ({ value: topic.value, label: topic.label })),
        defaultValue: ['nebula'],
      },
    ],
  },
];
