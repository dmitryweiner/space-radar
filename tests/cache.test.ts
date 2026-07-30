import { readCache, writeCache } from '../src/api/cache';

interface Payload {
  a: number;
}

function isPayload(value: unknown): value is Payload {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'a') === 'number';
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('cache', () => {
  it('returns null when nothing is stored for the key', () => {
    expect(readCache('missing', 60_000, isPayload)).toBeNull();
  });

  it('returns the stored value when within the TTL', () => {
    const now = 1_000_000;
    writeCache('k', { a: 1 }, now);
    expect(readCache('k', 60_000, isPayload, now + 30_000)).toEqual({ a: 1 });
  });

  it('returns null once the TTL has elapsed', () => {
    const now = 1_000_000;
    writeCache('k', { a: 1 }, now);
    expect(readCache('k', 60_000, isPayload, now + 60_001)).toBeNull();
  });

  it('returns null and does not throw on corrupted JSON', () => {
    window.localStorage.setItem('k', '{not json');
    expect(readCache('k', 60_000, isPayload)).toBeNull();
  });

  it('returns null when the stored entry has an unexpected shape', () => {
    window.localStorage.setItem('k', JSON.stringify({ oops: true }));
    expect(readCache('k', 60_000, isPayload)).toBeNull();
  });

  it('returns null when the cached value fails the validator', () => {
    const now = 1_000_000;
    writeCache('k', { a: 'not a number' }, now);
    expect(readCache('k', 60_000, isPayload, now)).toBeNull();
  });
});
