import { useEffect, useState } from 'react';
import { cardRegistry } from './layout/cardRegistry';
import { useLayoutState } from './layout/useLayoutState';
import { GridLayout } from './layout/GridLayout';
import { CardVisibilityMenu } from './layout/CardVisibilityMenu';
import { CardSettingsPopup } from './layout/CardSettingsPopup';
import { cardSettingsWithDefaults } from './layout/layoutState';
import { CardShell } from './cards/CardShell';

export function App() {
  const { visibleIds, layout, cardSettings, toggleVisible, updateLayout, resetLayout, updateCardSettings } =
    useLayoutState(cardRegistry);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [settingsCardId, setSettingsCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!fullscreenId) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFullscreenId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenId]);

  // Dismiss the Cards sidebar when clicking anywhere outside it (the toggle
  // button is excluded so its own onClick still handles the close).
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && (target.closest('#cardMenu') || target.closest('#cardsMenuBtn'))) {
        return;
      }
      setMenuOpen(false);
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen]);

  function toggleFullscreen(id: string) {
    setFullscreenId((current) => (current === id ? null : id));
  }

  const fullscreenCard = fullscreenId ? cardRegistry.find((card) => card.id === fullscreenId) : undefined;
  const FullscreenCardComponent = fullscreenCard?.component;
  const settingsCard = settingsCardId ? cardRegistry.find((card) => card.id === settingsCardId) : undefined;
  const settingsRect = settingsCardId ? layout[settingsCardId] : undefined;

  return (
    <div id="app">
      <header id="topbar">
        <span id="brand">Space Radar</span>
        <span className="tb-spacer" />
        <button
          id="cardsMenuBtn"
          type="button"
          className={menuOpen ? 'tb-btn tb-btn-active' : 'tb-btn'}
          aria-pressed={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
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
            cardSettings={cardSettings}
            onLayoutChange={updateLayout}
            onHide={toggleVisible}
            fullscreenId={fullscreenId}
            onToggleFullscreen={toggleFullscreen}
            onOpenSettings={setSettingsCardId}
          />
        </main>
      </div>
      {fullscreenCard && FullscreenCardComponent && (
        <div className="fullscreen-overlay" data-testid="fullscreen-overlay">
          <CardShell
            title={fullscreenCard.title}
            isFullscreen
            onToggleFullscreen={() => setFullscreenId(null)}
            onOpenSettings={() => setSettingsCardId(fullscreenCard.id)}
            onHide={() => {
              toggleVisible(fullscreenCard.id);
              setFullscreenId(null);
            }}
          >
            <FullscreenCardComponent settings={cardSettingsWithDefaults(fullscreenCard, cardSettings[fullscreenCard.id])} />
          </CardShell>
        </div>
      )}
      {settingsCard && settingsRect && (
        <CardSettingsPopup
          card={settingsCard}
          rect={settingsRect}
          values={cardSettings[settingsCard.id] ?? {}}
          onResize={(w, h) => updateLayout({ [settingsCard.id]: { ...settingsRect, w, h } })}
          onChangeSetting={(id, value) => updateCardSettings(settingsCard.id, { [id]: value })}
          onClose={() => setSettingsCardId(null)}
        />
      )}
    </div>
  );
}
