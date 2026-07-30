import { useState } from 'react';
import { cardRegistry } from './layout/cardRegistry';
import { useLayoutState } from './layout/useLayoutState';
import { GridLayout } from './layout/GridLayout';
import { CardVisibilityMenu } from './layout/CardVisibilityMenu';

export function App() {
  const { visibleIds, layout, toggleVisible, updateLayout, resetLayout } = useLayoutState(cardRegistry);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div id="app">
      <header id="topbar">
        <span id="brand">Space Radar</span>
        <span className="tb-spacer" />
        <button id="cardsMenuBtn" type="button" className="tb-btn" onClick={() => setMenuOpen((open) => !open)}>
          Cards
        </button>
        <button id="resetLayoutBtn" type="button" className="tb-btn" onClick={resetLayout}>
          Reset layout
        </button>
      </header>
      <div id="content">
        {menuOpen && (
          <aside id="cardMenu">
            <CardVisibilityMenu registry={cardRegistry} visibleIds={visibleIds} onToggle={toggleVisible} />
          </aside>
        )}
        <main id="viewWrap">
          <GridLayout
            registry={cardRegistry}
            visibleIds={visibleIds}
            layout={layout}
            onLayoutChange={updateLayout}
            onHide={toggleVisible}
          />
        </main>
      </div>
    </div>
  );
}
