import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AsteroidsCard } from '../src/cards/AsteroidsCard';
import { fetchAsteroids } from '../src/api/neows';

vi.mock('../src/api/neows', () => ({
  fetchAsteroids: vi.fn(),
}));

const SAMPLE = [
  {
    id: '1',
    name: 'Big Rock',
    hazardous: true,
    diameterMinKm: 1,
    diameterMaxKm: 2,
    closeApproachDate: '2026-Jul-30 08:00',
    missDistanceKm: 5_000_000,
    relativeVelocityKmH: 40000,
  },
  {
    id: '2',
    name: 'Small Pebble',
    hazardous: false,
    diameterMinKm: 0.01,
    diameterMaxKm: 0.02,
    closeApproachDate: '2026-Jul-29 12:00',
    missDistanceKm: 1_000_000,
    relativeVelocityKmH: 20000,
  },
];

function rowNames() {
  return screen.getAllByTestId('asteroid-row').map((row) => within(row).getByTestId('asteroid-name').textContent);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(fetchAsteroids).mockReset();
});

describe('AsteroidsCard', () => {
  it('shows a loading state before data arrives', () => {
    vi.mocked(fetchAsteroids).mockReturnValue(new Promise(() => {}));
    render(<AsteroidsCard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.mocked(fetchAsteroids).mockRejectedValue(new Error('NeoWs unreachable'));
    render(<AsteroidsCard />);
    expect(await screen.findByText(/neows unreachable/i)).toBeInTheDocument();
  });

  it('renders one row per asteroid, sorted by closest approach date first, with a hazard badge', async () => {
    vi.mocked(fetchAsteroids).mockResolvedValue(SAMPLE);
    render(<AsteroidsCard />);
    await screen.findAllByTestId('asteroid-row');
    expect(rowNames()).toEqual(['Small Pebble', 'Big Rock']);
    expect(screen.getByText('Hazardous')).toBeInTheDocument();
    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('re-sorts rows when a sortable column header is clicked', async () => {
    vi.mocked(fetchAsteroids).mockResolvedValue(SAMPLE);
    render(<AsteroidsCard />);
    await screen.findAllByTestId('asteroid-row');

    await userEvent.click(screen.getByRole('button', { name: /miss distance/i }));
    expect(rowNames()).toEqual(['Small Pebble', 'Big Rock']);

    await userEvent.click(screen.getByRole('button', { name: /miss distance/i }));
    expect(rowNames()).toEqual(['Big Rock', 'Small Pebble']);
  });
});
