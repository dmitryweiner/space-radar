import { useLaunches } from '../../hooks/sharedResources';
import type { CardComponentProps } from '../../layout/types';
import { numberSetting } from '../../layout/layoutState';
import { formatUtcTimestamp } from '../formatTimestamp';

const DEFAULT_COUNT = 8;

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
  const { data, loading, error } = useLaunches();

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
