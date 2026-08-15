import { render, screen } from '@testing-library/react';
import { GridLayout } from '../src/layout/GridLayout';
import type { CardDefinition, CardLayoutRect } from '../src/layout/types';

function CardA() {
  return <p>content a</p>;
}
function CardB() {
  return <p>content b</p>;
}

const registry: CardDefinition[] = [
  { id: 'a', title: 'Card A', defaultVisible: true, defaultLayout: { x: 0, y: 0, w: 1, h: 1 }, component: CardA },
  { id: 'b', title: 'Card B', defaultVisible: false, defaultLayout: { x: 1, y: 0, w: 1, h: 1 }, component: CardB },
];

const layout: Record<string, CardLayoutRect> = {
  a: { x: 0, y: 0, w: 1, h: 1 },
  b: { x: 1, y: 0, w: 1, h: 1 },
};

describe('GridLayout', () => {
  it('renders only the cards whose id is in visibleIds', () => {
    render(
      <GridLayout
        registry={registry}
        visibleIds={['a']}
        layout={layout}
        cardSettings={{}}
        mobileOrder={['a']}
        labelScale={1}
        rotateSpeed={1}
        rowHeight={160}
        onLayoutChange={() => {}}
        onMobileOrderChange={() => {}}
        onHide={() => {}}
        fullscreenId={null}
        onToggleFullscreen={() => {}}
        onOpenSettings={() => {}}
      />,
    );
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('content a')).toBeInTheDocument();
    expect(screen.queryByText('Card B')).not.toBeInTheDocument();
  });

  it('renders all visible cards when visibleIds includes both', () => {
    render(
      <GridLayout
        registry={registry}
        visibleIds={['a', 'b']}
        layout={layout}
        cardSettings={{}}
        mobileOrder={['a', 'b']}
        labelScale={1}
        rotateSpeed={1}
        rowHeight={160}
        onLayoutChange={() => {}}
        onMobileOrderChange={() => {}}
        onHide={() => {}}
        fullscreenId={null}
        onToggleFullscreen={() => {}}
        onOpenSettings={() => {}}
      />,
    );
    expect(screen.getByText('Card A')).toBeInTheDocument();
    expect(screen.getByText('Card B')).toBeInTheDocument();
  });

  it('replaces the fullscreen card content with a placeholder instead of double-mounting it', () => {
    render(
      <GridLayout
        registry={registry}
        visibleIds={['a', 'b']}
        layout={layout}
        cardSettings={{}}
        mobileOrder={['a', 'b']}
        labelScale={1}
        rotateSpeed={1}
        rowHeight={160}
        onLayoutChange={() => {}}
        onMobileOrderChange={() => {}}
        onHide={() => {}}
        fullscreenId="a"
        onToggleFullscreen={() => {}}
        onOpenSettings={() => {}}
      />,
    );
    expect(screen.queryByText('content a')).not.toBeInTheDocument();
    expect(screen.getByText('content b')).toBeInTheDocument();
    expect(screen.getByText('Card A')).toBeInTheDocument();
  });
});
