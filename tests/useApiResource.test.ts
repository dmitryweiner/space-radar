import { act, renderHook, waitFor } from '@testing-library/react';
import { useApiResource } from '../src/hooks/useApiResource';
import { writeCache } from '../src/api/cache';

interface Payload {
  value: number;
}

function isPayload(value: unknown): value is Payload {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'value') === 'number';
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useApiResource', () => {
  it('starts loading, then applies the fetched value and caches it', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 1 });
    const { result } = renderHook(() =>
      useApiResource({ key: 'k1', ttlMs: 60_000, pollMs: 300_000, fetcher, isValue: isPayload }),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ value: 1 });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();

    const cached = JSON.parse(window.localStorage.getItem('k1') ?? 'null');
    expect(cached.value).toEqual({ value: 1 });
  });

  it('uses a fresh cached value immediately without loading state or an initial fetch', () => {
    writeCache('k2', { value: 42 }, Date.now());
    const fetcher = vi.fn().mockResolvedValue({ value: 99 });

    const { result } = renderHook(() =>
      useApiResource({ key: 'k2', ttlMs: 60_000, pollMs: 300_000, fetcher, isValue: isPayload }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ value: 42 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('polls again after pollMs and updates the data', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn().mockResolvedValueOnce({ value: 1 }).mockResolvedValueOnce({ value: 2 });
      const { result } = renderHook(() =>
        useApiResource({ key: 'k3', ttlMs: 60_000, pollMs: 10_000, fetcher, isValue: isPayload }),
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.data).toEqual({ value: 1 });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      expect(result.current.data).toEqual({ value: 2 });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces an error and keeps the previous data on a failed fetch', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() =>
      useApiResource({ key: 'k4', ttlMs: 60_000, pollMs: 300_000, fetcher, isValue: isPayload }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('network down');
    expect(result.current.data).toBeNull();
  });
});
