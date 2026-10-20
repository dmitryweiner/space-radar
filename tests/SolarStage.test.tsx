import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SolarStage } from '../src/scene/SolarStage';
import { createSolarSystemScene } from '../src/render/solarSystemScene';
import type { SolarLayerDefinition } from '../src/layers/types';

const layerHandle = { setMarkers: vi.fn(), setTracks: vi.fn(), setVisible: vi.fn() };

const sceneHandle = {
  setPlanetPositions: vi.fn(),
  setOrbitPaths: vi.fn(),
  setMoons: vi.fn(),
  setOrientations: vi.fn(),
  focusBody: vi.fn(),
  setOnFocusChange: vi.fn(),
  setLabelScale: vi.fn(),
  setLowPower: vi.fn(),
  setAutoRotateSpeed: vi.fn(),
  layer: vi.fn(() => layerHandle),
  removeLayer: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../src/render/solarSystemScene', () => ({
  createSolarSystemScene: vi.fn(() => sceneHandle),
  markerFocusKey: (layerId: string, id: string) => `${layerId}/${id}`,
}));

const MARKERS = [{ id: 'm1', position: { xAu: 1, yAu: 0, zAu: 0 }, color: 0xffffff, label: 'Probe' }];
const TRACKS = [{ id: 'm1', points: [], color: 0xffffff }];
const FRAME = { markers: MARKERS, tracks: TRACKS };

const testLayer: SolarLayerDefinition = {
  id: 'test-layer',
  title: 'Test layer',
  color: '#fff',
  useLayer: () => ({
    frame: FRAME,
    loading: false,
    error: null,
    summary: '1 thing',
    legend: [],
    describe: () => ({ title: 'Probe', fields: [] }),
  }),
};

function renderStage(overrides: Partial<React.ComponentProps<typeof SolarStage>> = {}) {
  const props: React.ComponentProps<typeof SolarStage> = {
    layers: [],
    layerSettings: {},
    time: null,
    focus: null,
    labelScale: 1,
    rotateSpeed: 1,
    onFocusChange: vi.fn(),
    statesRef: { current: {} },
    onStatus: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SolarStage {...props} />) };
}

beforeEach(() => {
  vi.mocked(createSolarSystemScene).mockClear();
  for (const fn of Object.values(sceneHandle)) fn.mockClear();
  for (const fn of Object.values(layerHandle)) fn.mockClear();
});

describe('SolarStage', () => {
  it('mounts the scene once and feeds it planets, orbits, moons and real spin axes', async () => {
    renderStage();
    expect(createSolarSystemScene).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(sceneHandle.setPlanetPositions).toHaveBeenCalled());
    const [positions] = sceneHandle.setPlanetPositions.mock.calls[0];
    expect(positions).toHaveLength(8);
    const [paths] = sceneHandle.setOrbitPaths.mock.calls[0];
    expect(paths).toHaveLength(8);
    expect(paths[0].points.length).toBeGreaterThan(2);
    const [orientations] = sceneHandle.setOrientations.mock.calls[0];
    expect(Object.keys(orientations)).toEqual(expect.arrayContaining(['Sun', 'Mercury', 'Earth', 'Saturn', 'Neptune', 'Moon']));
  });

  it('feeds each enabled layer’s markers and tracks into its own scene layer, and removes it on unmount', async () => {
    const onStatus = vi.fn();
    const { unmount } = renderStage({ layers: [testLayer], onStatus });
    await vi.waitFor(() => expect(layerHandle.setMarkers).toHaveBeenCalledWith(MARKERS));
    expect(sceneHandle.layer).toHaveBeenCalledWith('test-layer');
    expect(layerHandle.setTracks).toHaveBeenCalledWith(TRACKS);
    expect(onStatus).toHaveBeenCalledWith('test-layer', expect.objectContaining({ summary: '1 thing' }));
    unmount();
    expect(sceneHandle.removeLayer).toHaveBeenCalledWith('test-layer');
    expect(sceneHandle.dispose).toHaveBeenCalledOnce();
  });

  it('passes the auto-rotate speed setting to the scene', async () => {
    const { rerender, props } = renderStage({ rotateSpeed: 2 });
    await vi.waitFor(() => expect(sceneHandle.setAutoRotateSpeed).toHaveBeenCalledWith(2));
    rerender(<SolarStage {...props} rotateSpeed={0} />);
    expect(sceneHandle.setAutoRotateSpeed).toHaveBeenLastCalledWith(0);
  });

  it('follows the focus prop and shows the focused name', async () => {
    const { rerender, props } = renderStage();
    await vi.waitFor(() => expect(sceneHandle.focusBody).toHaveBeenCalledWith(null));
    rerender(<SolarStage {...props} focus="Jupiter" />);
    expect(sceneHandle.focusBody).toHaveBeenLastCalledWith('Jupiter');
    expect(screen.getByText('Jupiter')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Whole system' }));
    expect(props.onFocusChange).toHaveBeenCalledWith(null);
  });

  it('reports a picked marker upward as both the new focus and a selection', async () => {
    const { props } = renderStage();
    const [handler] = sceneHandle.setOnFocusChange.mock.calls[0];
    act(() => handler({ key: 'spacecraft/-31', label: 'Voyager 1', layerId: 'spacecraft', markerId: '-31' }));
    expect(props.onFocusChange).toHaveBeenCalledWith('spacecraft/-31');
    expect(props.onSelect).toHaveBeenCalledWith({ layerId: 'spacecraft', hit: { kind: 'marker', id: '-31' } });

    act(() => handler({ key: 'Mars', label: 'Mars', layerId: null, markerId: null }));
    expect(props.onFocusChange).toHaveBeenLastCalledWith('Mars');
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });
});
