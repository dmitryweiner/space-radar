import { useApiResource } from '../../hooks/useApiResource';
import { fetchSpaceWeatherEvents } from '../../api/donki';
import type { SpaceWeatherEvent } from '../../api/types';

const CACHE_KEY = 'space-radar:space-weather-events';
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSpaceWeatherEvents(value: unknown): value is SpaceWeatherEvent[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        (item.kind === 'flare' || item.kind === 'cme') &&
        typeof item.id === 'string' &&
        typeof item.time === 'string' &&
        isNullableString(item.classType) &&
        isNullableString(item.sourceLocation),
    )
  );
}

function badgeColor(event: SpaceWeatherEvent): string {
  if (event.kind === 'cme') {
    return 'var(--series-1)';
  }
  switch (event.classType?.charAt(0).toUpperCase()) {
    case 'X':
      return 'var(--status-critical)';
    case 'M':
      return 'var(--status-serious)';
    case 'C':
      return 'var(--status-warning)';
    default:
      return 'var(--status-good)';
  }
}

function badgeLabel(event: SpaceWeatherEvent): string {
  return event.kind === 'cme' ? 'CME' : (event.classType ?? 'Flare');
}

export function SolarFlaresCard() {
  const { data, loading, error } = useApiResource<SpaceWeatherEvent[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchSpaceWeatherEvents(),
    isValue: isSpaceWeatherEvents,
  });

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="card-status">No recent flares or CMEs.</p>;
  }

  return (
    <ul className="event-list">
      {data.map((event) => (
        <li key={event.id} className="event-list-item">
          <span className="event-badge" style={{ backgroundColor: badgeColor(event) }}>
            {badgeLabel(event)}
          </span>
          <span className="event-time">{event.time}</span>
          {event.sourceLocation && <span className="event-location">{event.sourceLocation}</span>}
        </li>
      ))}
    </ul>
  );
}
