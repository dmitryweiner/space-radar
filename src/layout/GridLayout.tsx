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
  mobileOrder: string[];
  labelScale: number;
  onLayoutChange: (rects: Record<string, CardLayoutRect>) => void;
  onMobileOrderChange: (order: string[]) => void;
  onHide: (id: string) => void;
  fullscreenId: string | null;
  onToggleFullscreen: (id: string) => void;
  onOpenSettings: (id: string) => void;
}

export const GRID_COLS = 4;
// Below this container width, cards stack in a single, still-draggable
// column instead of the 4-col grid — matches the #cardMenu CSS breakpoint.
export const MOBILE_BREAKPOINT_PX = 700;
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

// Single-column layout: x/y/w are synthetic (always a full-width stack in
// `order`), only h carries real per-card data through from the desktop rects.
function toMobileRglLayout(
  registry: CardDefinition[],
  visibleIds: string[],
  order: string[],
  layout: Record<string, CardLayoutRect>,
): Layout {
  const byId = new Map(registry.map((card) => [card.id, card]));
  const knownVisible = new Set(visibleIds.filter((id) => byId.has(id)));
  // Defensive fallback for ids missing from `order` (shouldn't happen once
  // toggleVisibility keeps it in sync, but guards stale/hand-built state).
  const orderedIds = order.filter((id) => knownVisible.has(id));
  for (const id of knownVisible) {
    if (!orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }
  // Stack using each card's actual height in grid rows (not just its index) —
  // react-grid-layout's drag/collision math operates on the given y values
  // directly, so overlapping input (e.g. every h:2 card at consecutive
  // integer y's) confuses live reordering even though a static render still
  // looks right once the library's own compaction pass resolves it.
  let y = 0;
  return orderedIds.map((id) => {
    const rect = layout[id];
    const card = byId.get(id);
    const item = {
      i: id,
      x: 0,
      y,
      w: 1,
      h: rect.h,
      minW: 1,
      maxW: 1,
      minH: card?.defaultLayout.minH,
      maxH: card?.defaultLayout.maxH,
    };
    y += rect.h;
    return item;
  });
}

export function GridLayout({
  registry,
  visibleIds,
  layout,
  cardSettings,
  mobileOrder,
  labelScale,
  onLayoutChange,
  onMobileOrderChange,
  onHide,
  fullscreenId,
  onToggleFullscreen,
  onOpenSettings,
}: GridLayoutProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const byId = new Map(registry.map((card) => [card.id, card]));
  const isMobile = width > 0 && width < MOBILE_BREAKPOINT_PX;
  const cols = isMobile ? 1 : GRID_COLS;
  const rglLayout = isMobile
    ? toMobileRglLayout(registry, visibleIds, mobileOrder, layout)
    : toRglLayout(registry, visibleIds, layout);

  const handleLayoutChange = (nextLayout: Layout) => {
    if (isMobile) {
      onMobileOrderChange([...nextLayout].sort((a, b) => a.y - b.y).map((item) => item.i));
      // x/y/w are synthetic in the single-column view, but a height resize is
      // real per-card data — merge just the h into the (desktop) rect so it
      // isn't lost, without clobbering the desktop x/y/w with mobile's.
      const heightChanges: Record<string, CardLayoutRect> = {};
      for (const item of nextLayout) {
        const rect = layout[item.i];
        if (rect && rect.h !== item.h) {
          heightChanges[item.i] = { ...rect, h: item.h };
        }
      }
      if (Object.keys(heightChanges).length > 0) {
        onLayoutChange(heightChanges);
      }
      return;
    }
    onLayoutChange(fromRglLayout(nextLayout));
  };

  return (
    <div ref={containerRef} className="grid-layout-container">
      {mounted && (
        <ReactGridLayout
          layout={rglLayout}
          width={width}
          gridConfig={{ cols, rowHeight: ROW_HEIGHT, margin: [12, 12] }}
          // The header action buttons live inside the drag handle; `cancel`
          // keeps a tap on them from starting a drag, which on touch devices
          // otherwise swallowed the tap so the buttons never fired.
          dragConfig={{ enabled: true, handle: '.card-drag-handle', cancel: '.card-shell-actions' }}
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
                      <CardComponent settings={cardSettingsWithDefaults(card, cardSettings[id])} labelScale={labelScale} />
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
