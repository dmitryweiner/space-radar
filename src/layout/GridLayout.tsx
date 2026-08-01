import ReactGridLayout, { useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { CardShell } from '../cards/CardShell';
import { cardSettingsWithDefaults } from './layoutState';
import type { CardDefinition, CardLayoutRect, CardSettingValues } from './types';

interface GridLayoutProps {
  registry: CardDefinition[];
  visibleIds: string[];
  layout: Record<string, CardLayoutRect>;
  cardSettings: Record<string, CardSettingValues>;
  onLayoutChange: (rects: Record<string, CardLayoutRect>) => void;
  onHide: (id: string) => void;
  fullscreenId: string | null;
  onToggleFullscreen: (id: string) => void;
  onOpenSettings: (id: string) => void;
}

export const GRID_COLS = 4;
const ROW_HEIGHT = 160;

function toRglLayout(registry: CardDefinition[], visibleIds: string[], layout: Record<string, CardLayoutRect>): Layout {
  const byId = new Map(registry.map((card) => [card.id, card]));
  return visibleIds
    .filter((id) => byId.has(id))
    .map((id) => {
      const rect = layout[id];
      const card = byId.get(id);
      return {
        i: id,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        minW: card?.defaultLayout.minW,
        minH: card?.defaultLayout.minH,
        maxW: card?.defaultLayout.maxW,
        maxH: card?.defaultLayout.maxH,
      };
    });
}

function fromRglLayout(items: Layout): Record<string, CardLayoutRect> {
  const rects: Record<string, CardLayoutRect> = {};
  for (const item of items) {
    rects[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h };
  }
  return rects;
}

export function GridLayout({
  registry,
  visibleIds,
  layout,
  cardSettings,
  onLayoutChange,
  onHide,
  fullscreenId,
  onToggleFullscreen,
  onOpenSettings,
}: GridLayoutProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const byId = new Map(registry.map((card) => [card.id, card]));
  const rglLayout = toRglLayout(registry, visibleIds, layout);

  const handleLayoutChange = (nextLayout: Layout) => {
    onLayoutChange(fromRglLayout(nextLayout));
  };

  return (
    <div ref={containerRef} className="grid-layout-container">
      {mounted && (
        <ReactGridLayout
          layout={rglLayout}
          width={width}
          gridConfig={{ cols: GRID_COLS, rowHeight: ROW_HEIGHT, margin: [12, 12] }}
          dragConfig={{ enabled: true, handle: '.card-drag-handle' }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={handleLayoutChange}
        >
          {visibleIds
            .filter((id) => byId.has(id))
            .map((id) => {
              const card = byId.get(id);
              if (!card) {
                return null;
              }
              const CardComponent = card.component;
              const isFullscreen = id === fullscreenId;
              return (
                <div key={id} data-card-id={id}>
                  <CardShell
                    title={card.title}
                    onHide={() => onHide(id)}
                    onToggleFullscreen={() => onToggleFullscreen(id)}
                    onOpenSettings={() => onOpenSettings(id)}
                  >
                    {isFullscreen ? (
                      <p className="card-status">Shown full screen.</p>
                    ) : (
                      <CardComponent settings={cardSettingsWithDefaults(card, cardSettings[id])} />
                    )}
                  </CardShell>
                </div>
              );
            })}
        </ReactGridLayout>
      )}
    </div>
  );
}
