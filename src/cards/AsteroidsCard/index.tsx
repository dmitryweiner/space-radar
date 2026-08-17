import { useState } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { fetchAsteroids } from '../../api/neows';
import type { Asteroid } from '../../api/types';

const CACHE_KEY = 'space-radar:asteroids';
const TTL_MS = 60 * 60 * 1000;
const POLL_MS = 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAsteroids(value: unknown): value is Asteroid[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.hazardous === 'boolean' &&
        typeof item.diameterMinKm === 'number' &&
        typeof item.diameterMaxKm === 'number' &&
        typeof item.closeApproachDate === 'string' &&
        typeof item.missDistanceKm === 'number' &&
        typeof item.relativeVelocityKmH === 'number' &&
        (item.jplUrl === null || typeof item.jplUrl === 'string'),
    )
  );
}

type SortKey = 'name' | 'closeApproachDate' | 'missDistanceKm' | 'relativeVelocityKmH' | 'diameterMaxKm';

interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'closeApproachDate', label: 'Close approach' },
  { key: 'missDistanceKm', label: 'Miss distance' },
  { key: 'relativeVelocityKmH', label: 'Velocity' },
  { key: 'diameterMaxKm', label: 'Diameter' },
];

function compareValues(a: Asteroid, b: Asteroid, key: SortKey): number {
  const left = a[key];
  const right = b[key];
  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right);
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return 0;
}

export function AsteroidsCard() {
  const { data, loading, error } = useApiResource<Asteroid[]>({
    key: CACHE_KEY,
    ttlMs: TTL_MS,
    pollMs: POLL_MS,
    fetcher: () => fetchAsteroids(),
    isValue: isAsteroids,
  });
  const [sort, setSort] = useState<SortState>({ key: 'closeApproachDate', dir: 'asc' });

  if (loading) {
    return <p className="card-status">Loading…</p>;
  }
  if (error) {
    return <p className="card-status card-status-error">{error}</p>;
  }
  if (!data || data.length === 0) {
    return <p className="card-status">No upcoming close approaches.</p>;
  }

  const sorted = [...data].sort((a, b) => {
    const cmp = compareValues(a, b, sort.key);
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  return (
    <table className="asteroid-table">
      <thead>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col.key}>
              <button type="button" className="sort-btn" onClick={() => handleSort(col.key)}>
                {col.label}
              </button>
            </th>
          ))}
          <th>Hazard</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((asteroid) => (
          <tr key={asteroid.id} data-testid="asteroid-row">
            <td data-testid="asteroid-name">
              {asteroid.jplUrl ? (
                <a href={asteroid.jplUrl} target="_blank" rel="noreferrer" className="detail-link">
                  {asteroid.name}
                </a>
              ) : (
                asteroid.name
              )}
            </td>
            <td>{asteroid.closeApproachDate}</td>
            <td>{Math.round(asteroid.missDistanceKm).toLocaleString()} km</td>
            <td>{Math.round(asteroid.relativeVelocityKmH).toLocaleString()} km/h</td>
            <td>
              {asteroid.diameterMinKm.toFixed(2)}–{asteroid.diameterMaxKm.toFixed(2)} km
            </td>
            <td>
              <span
                className="hazard-badge"
                style={{ backgroundColor: asteroid.hazardous ? 'var(--status-critical)' : 'var(--status-good)' }}
              >
                {asteroid.hazardous ? 'Hazardous' : 'Safe'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
