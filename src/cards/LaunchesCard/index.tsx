import { useApiResource } from '../../hooks/useApiResource';
import { fetchUpcomingLaunches } from '../../api/launchLibrary';
import type { LaunchInfo } from '../../api/types';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';
import { formatUtcTimestamp } from '../formatTimestamp';

const CACHE_KEY = 'space-radar:launches';
// Launch Library's free tier allows only 15 requests/hour — poll slowly.
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;
const DEFAULT_COUNT = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isLaunches(value: unknown): value is LaunchInfo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.status === 'string' &&
        typeof item.net === 'string' &&
        isNullableString(item.provider) &&
        isNullableString(item.location) &&
        isNullableString(item.detailUrl),
    )
  );
}

function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'go':
      return 'var(--status-good)';
    case 'tbc':
    case 'tbd':
      return 'var(--status-warning)';
    default:
      return 'var(--series-1)';
  }
}

export function LaunchesCard({ settings = {} }: CardComponentProps) {
  const { data, loading, error } = useApiResource<LaunchInfo[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchUpcomingLaunches(),
    isValue: isLaunches,
  });

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="card-status">No upcoming launches.</p>;
  }

  return (
    <ul className="launch-list">
      {data.slice(0, numberSetting(settings, 'count', DEFAULT_COUNT)).map((launch) => (
        <li key={launch.id} className="launch-list-item" data-testid="launch-row">
          <div className="launch-list-headline">
            <span className="event-badge" style={{ backgroundColor: statusColor(launch.status) }}>
              {launch.status}
            </span>
            <span className="launch-name">{launch.name}</span>
          </div>
          <div className="launch-list-details">
            <span className="event-time">{formatUtcTimestamp(launch.net)}</span>
            {launch.provider && <span>{launch.provider}</span>}
            {launch.location && <span>{launch.location}</span>}
            {launch.detailUrl && (
              <a href={launch.detailUrl} target="_blank" rel="noreferrer" className="detail-link">
                Details ↗
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
