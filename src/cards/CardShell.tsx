import type { ReactNode } from 'react';

interface CardShellProps {
  title: string;
  onHide: () => void;
  children: ReactNode;
}

export function CardShell({ title, onHide, children }: CardShellProps) {
  return (
    <div className="card-shell">
      <div className="card-shell-header card-drag-handle">
        <span className="card-shell-title">{title}</span>
        <button
          type="button"
          className="card-shell-hide"
          aria-label={`Hide ${title}`}
          onClick={onHide}
        >
          ×
        </button>
      </div>
      <div className="card-shell-body">{children}</div>
    </div>
  );
}
