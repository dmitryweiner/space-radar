import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardShell } from '../src/cards/CardShell';

describe('CardShell', () => {
  it('renders the title and children', () => {
    render(
      <CardShell title="Kp-index" onHide={() => {}} onToggleFullscreen={() => {}}>
        <p>chart</p>
      </CardShell>,
    );
    expect(screen.getByText('Kp-index')).toBeInTheDocument();
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('calls onHide when the hide button is clicked', async () => {
    const onHide = vi.fn();
    render(
      <CardShell title="Kp-index" onHide={onHide} onToggleFullscreen={() => {}}>
        <p>chart</p>
      </CardShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide Kp-index' }));
    expect(onHide).toHaveBeenCalledOnce();
  });

  it('calls onToggleFullscreen when the full screen button is clicked', async () => {
    const onToggleFullscreen = vi.fn();
    render(
      <CardShell title="Kp-index" onHide={() => {}} onToggleFullscreen={onToggleFullscreen}>
        <p>chart</p>
      </CardShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Full screen Kp-index' }));
    expect(onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it('labels the button as exit full screen when already fullscreen', () => {
    render(
      <CardShell title="Kp-index" onHide={() => {}} onToggleFullscreen={() => {}} isFullscreen>
        <p>chart</p>
      </CardShell>,
    );
    expect(screen.getByRole('button', { name: 'Exit full screen for Kp-index' })).toBeInTheDocument();
  });

  it('hides the hide button in fullscreen so the card cannot be closed by mistake', () => {
    render(
      <CardShell title="Kp-index" onHide={() => {}} onToggleFullscreen={() => {}} isFullscreen>
        <p>chart</p>
      </CardShell>,
    );
    expect(screen.queryByRole('button', { name: 'Hide Kp-index' })).not.toBeInTheDocument();
  });
});
