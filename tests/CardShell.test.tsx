import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardShell } from '../src/cards/CardShell';

describe('CardShell', () => {
  it('renders the title and children', () => {
    render(
      <CardShell title="Kp-index" onHide={() => {}}>
        <p>chart</p>
      </CardShell>,
    );
    expect(screen.getByText('Kp-index')).toBeInTheDocument();
    expect(screen.getByText('chart')).toBeInTheDocument();
  });

  it('calls onHide when the hide button is clicked', async () => {
    const onHide = vi.fn();
    render(
      <CardShell title="Kp-index" onHide={onHide}>
        <p>chart</p>
      </CardShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Hide Kp-index' }));
    expect(onHide).toHaveBeenCalledOnce();
  });
});
