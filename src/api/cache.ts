function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCacheEntry(value: unknown): value is { value: unknown; fetchedAt: number } {
  return isRecord(value) && 'value' in value && typeof value.fetchedAt === 'number';
}

export function readCache<T>(
  key: string,
  ttlMs: number,
  isValue: (value: unknown) => value is T,
  now: number = Date.now(),
): T | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isCacheEntry(parsed) || now - parsed.fetchedAt > ttlMs || !isValue(parsed.value)) {
    return null;
  }
  return parsed.value;
}

export function writeCache<T>(key: string, value: T, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ value, fetchedAt: now }));
  } catch {
    // Storage full (QuotaExceededError) or unavailable — the cache is
    // best-effort and the in-memory value is unaffected, so skip persisting
    // rather than letting a large response (e.g. a full satellite group) throw.
  }
}
