interface ZoomButtonsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

// On-screen +/- zoom for the 3D cards, mirroring the +/- keyboard shortcut.
// Rendered as an overlay inside the canvas wrapper; pointer events on the
// buttons don't reach OrbitControls, so clicking never starts a drag.
export function ZoomButtons({ onZoomIn, onZoomOut }: ZoomButtonsProps) {
  return (
    <div className="zoom-buttons">
      <button type="button" className="zoom-btn" onClick={onZoomIn} aria-label="Zoom in">
        +
      </button>
      <button type="button" className="zoom-btn" onClick={onZoomOut} aria-label="Zoom out">
        −
      </button>
    </div>
  );
}
