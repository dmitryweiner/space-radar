interface MarkerInfoField {
  label: string;
  value: string;
}

interface MarkerInfoPopupProps {
  title: string;
  fields: MarkerInfoField[];
  detailUrl?: string | null;
  onClose: () => void;
}

// Shared by every createEarthScene-based card: a small panel shown when a
// marker/satellite/fire/aurora point is clicked. Positioned top-right inside
// .globe-wrap so it doesn't collide with the status text (top-left) or the
// legend (bottom-left) other cards already render there.
export function MarkerInfoPopup({ title, fields, detailUrl, onClose }: MarkerInfoPopupProps) {
  return (
    <div className="marker-info-popup" data-testid="marker-info-popup">
      <div className="marker-info-popup-header">
        <span className="marker-info-popup-title">{title}</span>
        <button type="button" className="card-shell-action" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <dl className="marker-info-popup-fields">
        {fields.map((field) => (
          <div key={field.label} className="marker-info-popup-field">
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {detailUrl && (
        <a href={detailUrl} target="_blank" rel="noreferrer" className="detail-link">
          Details ↗
        </a>
      )}
    </div>
  );
}
