import { render } from '@testing-library/react';
import { SolarSystemCard } from '../src/cards/SolarSystemCard';
import { createSolarSystemScene } from '../src/render/solarSystemScene';

const sceneHandle = {
  setPlanetPositions: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../src/render/solarSystemScene', () => ({
  createSolarSystemScene: vi.fn(() => sceneHandle),
}));

beforeEach(() => {
  vi.mocked(createSolarSystemScene).mockClear();
  sceneHandle.setPlanetPositions.mockClear();
  sceneHandle.dispose.mockClear();
});

describe('SolarSystemCard', () => {
  it('mounts the scene once and feeds it all eight planet positions', () => {
    render(<SolarSystemCard />);
    expect(createSolarSystemScene).toHaveBeenCalledOnce();
    expect(sceneHandle.setPlanetPositions).toHaveBeenCalledOnce();
    const [positions] = sceneHandle.setPlanetPositions.mock.calls[0];
    expect(positions).toHaveLength(8);
    expect(positions[0].name).toBe('Mercury');
  });

  it('disposes the scene on unmount', () => {
    const { unmount } = render(<SolarSystemCard />);
    unmount();
    expect(sceneHandle.dispose).toHaveBeenCalledOnce();
  });
});
