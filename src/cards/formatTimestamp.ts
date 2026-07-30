const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/;

export function formatUtcTimestamp(iso: string): string {
  const match = iso.match(TIMESTAMP_PATTERN);
  if (!match) {
    return iso;
  }
  return `${match[1]} ${match[2]} UTC`;
}
