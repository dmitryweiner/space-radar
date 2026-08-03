import type { NasaImage } from './types';

// NASA Image and Video Library — no key, CORS `*`. Each topic maps to a search
// query; the card picks random images from the merged pool of selected topics.
const SEARCH_URL = 'https://images-api.nasa.gov/search';
// Keep only a slice of each 100-item result set so the merged cache stays small.
const PER_TOPIC_LIMIT = 30;

export interface NasaImageTopic {
  value: string;
  label: string;
}

export const NASA_IMAGE_TOPICS: NasaImageTopic[] = [
  { value: 'nebula', label: 'Nebulae' },
  { value: 'galaxy', label: 'Galaxies' },
  { value: 'apollo', label: 'Apollo' },
  { value: 'jupiter', label: 'Jupiter' },
  { value: 'mars', label: 'Mars' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'earth', label: 'Earth' },
];

const ALLOWED_TOPICS = new Set(NASA_IMAGE_TOPICS.map((topic) => topic.value));

export function nasaImagesSearchUrl(query: string): string {
  return `${SEARCH_URL}?q=${encodeURIComponent(query)}&media_type=image`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstImageLink(links: unknown): string | null {
  if (!Array.isArray(links)) {
    return null;
  }
  for (const link of links) {
    if (isRecord(link) && typeof link.href === 'string' && link.href.startsWith('https://')) {
      return link.href;
    }
  }
  return null;
}

export function parseNasaImages(raw: unknown): NasaImage[] {
  if (!isRecord(raw) || !isRecord(raw.collection) || !Array.isArray(raw.collection.items)) {
    return [];
  }
  const images: NasaImage[] = [];
  for (const item of raw.collection.items) {
    if (!isRecord(item) || !Array.isArray(item.data) || item.data.length === 0) {
      continue;
    }
    const meta = item.data[0];
    const imageUrl = firstImageLink(item.links);
    if (!isRecord(meta) || typeof meta.nasa_id !== 'string' || !imageUrl) {
      continue;
    }
    images.push({
      id: meta.nasa_id,
      title: typeof meta.title === 'string' ? meta.title : 'Untitled',
      description: typeof meta.description === 'string' ? meta.description : null,
      dateCreated: typeof meta.date_created === 'string' ? meta.date_created : null,
      imageUrl,
    });
  }
  return images;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
}

type FetchFn = (url: string) => Promise<FetchResponse>;

export async function fetchNasaImages(query: string, fetchFn: FetchFn = fetch): Promise<NasaImage[]> {
  const response = await fetchFn(nasaImagesSearchUrl(query));
  if (!response.ok) {
    throw new Error(`NASA image search for "${query}" failed with status ${response.status ?? 'unknown'}`);
  }
  return parseNasaImages(await response.json()).slice(0, PER_TOPIC_LIMIT);
}

// Fetch every selected topic in parallel and merge, deduping by nasa_id. One
// failing topic is tolerated; only an all-failing selection throws.
export async function fetchNasaImagesForTopics(topics: string[], fetchFn: FetchFn = fetch): Promise<NasaImage[]> {
  const selected = topics.filter((topic) => ALLOWED_TOPICS.has(topic));
  const effective = selected.length > 0 ? selected : ['nebula'];

  const results = await Promise.allSettled(effective.map((topic) => fetchNasaImages(topic, fetchFn)));

  const byId = new Map<string, NasaImage>();
  let anyFulfilled = false;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      anyFulfilled = true;
      for (const image of result.value) {
        byId.set(image.id, image);
      }
    }
  }
  if (!anyFulfilled) {
    throw new Error('NASA image search is unavailable.');
  }
  return [...byId.values()];
}
