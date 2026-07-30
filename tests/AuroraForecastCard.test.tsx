import { act, render, screen } from '@testing-library/react';
import { AuroraForecastCard } from '../src/cards/AuroraForecastCard';

describe('AuroraForecastCard', () => {
  it('renders the NOAA OVATION forecast image with a descriptive alt text', () => {
    render(<AuroraForecastCard />);
    const img = screen.getByRole('img', { name: /aurora forecast/i });
    expect(img.getAttribute('src')).toMatch(/^https:\/\/services\.swpc\.noaa\.gov\//);
  });

  it('refreshes the image URL periodically to bust the browser cache', () => {
    vi.useFakeTimers();
    try {
      render(<AuroraForecastCard />);
      const img = screen.getByRole('img', { name: /aurora forecast/i });
      const firstSrc = img.getAttribute('src');

      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000 + 1);
      });

      expect(img.getAttribute('src')).not.toBe(firstSrc);
    } finally {
      vi.useRealTimers();
    }
  });
});
