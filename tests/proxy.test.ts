import { fetchViaProxy, proxyUrlFor } from '../src/api/proxy';

const BASE = 'https://proxy.test';
const DIRECT = 'https://api.nasa.gov/planetary/apod?api_key=CLIENT&thumbs=true';

describe('proxyUrlFor', () => {
  it('maps a covered upstream URL to the key-free proxy URL', () => {
    expect(proxyUrlFor(DIRECT, BASE)).toBe('https://proxy.test/nasa/planetary/apod?thumbs=true');
  });

  it('is null for uncovered URLs or a disabled proxy', () => {
    expect(proxyUrlFor('https://example.com/a', BASE)).toBeNull();
    expect(proxyUrlFor(DIRECT, '')).toBeNull();
  });
});

describe('fetchViaProxy', () => {
  it('uses the proxy response when it is ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, tag: 'proxy' }));
    const response = await fetchViaProxy(fetchFn, DIRECT, BASE);
    expect(response.tag).toBe('proxy');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://proxy.test/nasa/planetary/apod?thumbs=true');
  });

  it('falls back to the direct URL when the proxy errors or is unreachable', async () => {
    const failing = vi.fn(async (url: string) => ({ ok: !url.startsWith(BASE), url }));
    expect((await fetchViaProxy(failing, DIRECT, BASE)).url).toBe(DIRECT);

    const throwing = vi.fn(async (url: string) => {
      if (url.startsWith(BASE)) {
        throw new TypeError('Failed to fetch');
      }
      return { ok: true, url };
    });
    expect((await fetchViaProxy(throwing, DIRECT, BASE)).url).toBe(DIRECT);
  });

  it('goes straight to the direct URL when no route covers it', async () => {
    const fetchFn = vi.fn(async (url: string) => ({ ok: true, url }));
    await fetchViaProxy(fetchFn, 'https://example.com/a', BASE);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('https://example.com/a');
  });
});
