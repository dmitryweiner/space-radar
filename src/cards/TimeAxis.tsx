const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

export interface TimeAxisLabel {
  /** 0..1 fraction of the chart width. */
  position: number;
  text: string;
}

// Mirrors the labelling scheme of the sibling solar-weather-widget's
// ChartRenderer: a handful of evenly spaced ticks, repeating the date part
// only when it changes between neighbouring labels.
export function buildTimeAxisLabels(times: string[], maxLabels = 4, align: 'bar' | 'line' = 'line'): TimeAxisLabel[] {
  if (times.length < 2) {
    return [];
  }
  const count = Math.min(maxLabels, times.length);
  const labels: TimeAxisLabel[] = [];
  let lastDate = '';
  for (let slot = 0; slot < count; slot += 1) {
    const index = Math.round((slot / (count - 1)) * (times.length - 1));
    const match = times[index].match(TIMESTAMP_PATTERN);
    if (!match) {
      continue;
    }
    const [, , month, day, hours, minutes] = match;
    const date = `${day}.${month}`;
    const time = `${hours}:${minutes}`;
    const text = date === lastDate ? time : `${date} ${time}`;
    lastDate = date;
    const position =
      align === 'bar' ? (index + 0.5) / times.length : index / (times.length - 1);
    labels.push({ position, text });
  }
  return labels;
}

interface TimeAxisProps {
  times: string[];
  maxLabels?: number;
  align?: 'bar' | 'line';
}

export function TimeAxis({ times, maxLabels = 4, align = 'line' }: TimeAxisProps) {
  const labels = buildTimeAxisLabels(times, maxLabels, align);
  if (labels.length === 0) {
    return null;
  }
  const last = labels.length - 1;
  return (
    <div className="time-axis" data-testid="time-axis">
      {labels.map((label, i) => {
        const style =
          i === 0 && label.position < 0.1
            ? { left: 0 }
            : i === last && label.position > 0.9
              ? { right: 0 }
              : { left: `${(label.position * 100).toFixed(1)}%`, transform: 'translateX(-50%)' };
        return (
          <span key={label.position} className="time-axis-label" style={style}>
            {label.text}
          </span>
        );
      })}
    </div>
  );
}
