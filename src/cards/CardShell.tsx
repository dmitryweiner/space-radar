import type { ReactNode } from 'react';

interface CardShellProps {
  title: string;
  onHide: () => void;
  onToggleFullscreen: () => void;
  onOpenSettings?: () => void;
  isFullscreen?: boolean;
  children: ReactNode;
}

export function CardShell({ title, onHide, onToggleFullscreen, onOpenSettings, isFullscreen = false, children }: CardShellProps) {
  return (
    <div className={isFullscreen ? 'card-shell card-shell-fullscreen' : 'card-shell'}>
      <div className="card-shell-header card-drag-handle">
        <span className="card-shell-title">{title}</span>
        <div className="card-shell-actions">
          {onOpenSettings && (
            <button
              type="button"
              className="card-shell-action"
              aria-label={`Settings for ${title}`}
              title="Settings"
              onClick={onOpenSettings}
            >
              ⚙️
            </button>
          )}
          <button
            type="button"
            className="card-shell-action"
            aria-label={isFullscreen ? `Exit full screen for ${title}` : `Full screen ${title}`}
            title={isFullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={onToggleFullscreen}
          >
            ⛶
          </button>
          <button
            type="button"
            className="card-shell-action card-shell-hide"
            aria-label={`Hide ${title}`}
            title="Hide"
            onClick={onHide}
          >
            ×
          </button>
        </div>
      </div>
      <div className="card-shell-body">{children}</div>
    </div>
  );
}
