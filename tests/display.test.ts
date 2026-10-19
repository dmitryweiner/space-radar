import { formatDiameter, formatDistance, formatSpeed, formatSpeedPerHour, formatTime } from '../src/format/display';
import { createFrameGate } from '../src/render/lowPower';

describe('formatTime', () => {
  it('formats ISO, epoch ms and zone-less UTC strings in UTC', () => {
    expect(formatTime('2026-10-14T03:49:00Z', 'utc')).toBe('2026-10-14 03:49 UTC');
    expect(formatTime(Date.UTC(2026, 9, 19, 6, 23), 'utc')).toBe('2026-10-19 06:23 UTC');
    // SWPC/EPIC "YYYY-MM-DD hh:mm:ss" with no zone is UTC.
    expect(formatTime('2026-10-19 06:23:00.000', 'utc')).toBe('2026-10-19 06:23 UTC');
    expect(formatTime('2026-10-19 0623', 'utc')).toBe('2026-10-19 0623');
  });

  it('shows local time with a zone label', () => {
    const ms = Date.UTC(2026, 9, 19, 6, 23);
    const d = new Date(ms);
    const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const text = formatTime(ms, 'local');
    expect(text).toContain(hhmm);
    expect(text).not.toMatch(/UTC$/);
  });

  it('passes unparseable strings through', () => {
    expect(formatTime('TBD', 'utc')).toBe('TBD');
  });
});

describe('unit formatters', () => {
  it('formats km or miles', () => {
    expect(formatDistance(1609.344, 0, 'metric')).toBe('1,609 km');
    expect(formatDistance(1609.344, 0, 'imperial')).toBe('1,000 mi');
    expect(formatSpeed(7.66, 1, 'metric')).toBe('7.7 km/s');
    expect(formatSpeed(16.09344, 1, 'imperial')).toBe('10.0 mi/s');
    expect(formatSpeedPerHour(160.9344, 'imperial')).toBe('100 mph');
    expect(formatDiameter(1.609344, 3.218688, 'imperial')).toBe('1.00–2.00 mi');
  });
});

describe('createFrameGate', () => {
  it('renders every frame normally and at most ~30 fps in low-power mode', () => {
    const gate = createFrameGate();
    expect([0, 16, 33, 50].map((t) => gate.shouldRender(t))).toEqual([true, true, true, true]);
    gate.setLowPower(true);
    expect([100, 116.7, 133.4, 150, 166.7].map((t) => gate.shouldRender(t))).toEqual([true, false, true, false, true]);
  });
});
