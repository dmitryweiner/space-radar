import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardVisibilityMenu } from '../src/layout/CardVisibilityMenu';
import type { CardDefinition } from '../src/layout/types';

function Placeholder() {
  return null;
}

const registry: CardDefinition[] = [
  { id: 'a', title: 'Card A', defaultVisible: true, defaultLayout: { x: 0, y: 0, w: 1, h: 1 }, component: Placeholder },
  { id: 'b', title: 'Card B', defaultVisible: false, defaultLayout: { x: 1, y: 0, w: 1, h: 1 }, component: Placeholder },
];

describe('CardVisibilityMenu', () => {
  it('renders one checkbox per registered card, checked according to visibleIds', () => {
    render(<CardVisibilityMenu registry={registry} visibleIds={['a']} onToggle={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Card A' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Card B' })).not.toBeChecked();
  });

  it('calls onToggle with the card id when a checkbox is clicked', async () => {
    const onToggle = vi.fn();
    render(<CardVisibilityMenu registry={registry} visibleIds={['a']} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Card B' }));
    expect(onToggle).toHaveBeenCalledWith('b');
  });
});
