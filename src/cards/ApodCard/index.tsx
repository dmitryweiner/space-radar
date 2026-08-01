import { useApiResource } from '../../hooks/useApiResource';
import { fetchApod } from '../../api/apod';
import type { ApodInfo } from '../../api/types';

const CACHE_KEY = 'space-radar:apod';
const TTL_MS = 6 * 60 * 60 * 1000;
const POLL_MS = 6 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isApod(value: unknown): value is ApodInfo {
  return (
    isRecord(value) &&
    typeof value.date === 'string' &&
    typeof value.title === 'string' &&
    typeof value.mediaType === 'string' &&
    isNullableString(value.imageUrl) &&
    isNullableString(value.linkUrl) &&
    isNullableString(value.copyright)
  );
}

export function ApodCard() {
  const { data, loading, error } = useApiResource<ApodInfo>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchApod(),
    isValue: isApod,
  });

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!data) {
    return <p className="card-status">No picture available.</p>;
  }

  return (
    <div className="apod-card">
      {data.imageUrl ? (
        <a href={data.linkUrl ?? data.imageUrl} target="_blank" rel="noreferrer" className="apod-image-link">
          <img src={data.imageUrl} alt={data.title} className="apod-image" />
        </a>
      ) : (
        <p className="card-status">Today's APOD has no previewable image.</p>
      )}
      <p className="chart-status-line">
        <strong>{data.title}</strong> — {data.date}
        {data.copyright && <span className="apod-copyright"> · © {data.copyright.trim()}</span>}
      </p>
    </div>
  );
}
