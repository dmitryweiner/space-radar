import { useMemo, useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchNasaImagesForTopics } from '../../api/nasaImages';
import type { NasaImage } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { listSetting } from '../../layout/layoutState';

const TTL_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TOPICS = ['nebula'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNasaImages(value: unknown): value is NasaImage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.imageUrl === 'string' &&
        isNullableString(item.description) &&
        isNullableString(item.dateCreated),
    )
  );
}

// Deterministic shuffle seeded by array length so a given result set always
// presents in the same order — "More" then walks it without repeats.
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  let seed = copy.length * 2654435761;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function NasaImagesCard({ settings = {} }: CardComponentProps) {
  const topics = listSetting(settings, 'topics', DEFAULT_TOPICS);
  const cacheKey = `space-radar:nasa-images:${[...topics].sort().join(',')}`;

  const { data, loading, error } = useApiResource<NasaImage[]>({
    key: cacheKey,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchNasaImagesForTopics(topics),
    isValue: isNasaImages,
  });

  const order = useMemo(() => shuffled(data ?? []), [data]);
  const [index, setIndex] = useState(0);

  // Reset to the first image whenever the pool changes (topics/data) — the
  // React-recommended "adjust state during render" pattern rather than an effect.
  const [prevOrder, setPrevOrder] = useState(order);
  if (order !== prevOrder) {
    setPrevOrder(order);
    setIndex(0);
  }

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (order.length === 0) {
    return <p className="card-status">No images found for the selected topics.</p>;
  }

  const image = order[index % order.length];

  return (
    <div className="nasa-images-card">
      <div className="nasa-images-frame">
        <a href={image.imageUrl} target="_blank" rel="noreferrer" className="apod-image-link">
          <img src={image.imageUrl} alt={image.title} className="apod-image" />
        </a>
      </div>
      <div className="nasa-images-footer">
        <p className="chart-status-line nasa-images-title">
          <strong>{image.title}</strong>
          {image.dateCreated && <span className="apod-copyright"> · {image.dateCreated.slice(0, 10)}</span>}
        </p>
        <button type="button" className="tb-btn nasa-images-more" onClick={() => setIndex((i) => i + 1)}>
          More →
        </button>
      </div>
    </div>
  );
}
