import { createHandler, type CachedEntry, type Env, type KvNamespace } from '../worker/src/index';

function memoryKv(): KvNamespace & { store: Map<string, string>; failWrites: boolean } {
  const store = new Map<string, string>();
  return {
    store,
    failWrites: false,
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      if (this.failWrites) {
        throw new Error('KV put() limit exceeded for the day.');
      }
      store.set(key, value);
    },
  };
}

function setup(upstream: (url: string) => Promise<Response>) {
  let now = 1_000_000;
  const kv = memoryKv();
  const env: Env = { CACHE: kv, NASA_API_KEY: 'K', FIRMS_MAP_KEY: 'F' };
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) };
  const fetchUpstream = vi.fn(upstream);
  const handle = createHandler({ fetchUpstream, now: () => now });
  return {
    kv,
    fetchUpstream,
    advance: (ms: number) => {
      now += ms;
    },
    get: (path: string) => handle(new Request(`https://proxy.test${path}`), env, ctx),
    settle: () => Promise.all(pending),
  };
}

const KP = '/swpc/products/noaa-planetary-k-index.json';

describe('proxy handler', () => {
  it('misses, then hits from cache without calling the upstream again', async () => {
    const t = setup(async () => new Response('[1]', { headers: { 'content-type': 'application/json' } }));
    const first = await t.get(KP);
    expect(first.headers.get('x-cache')).toBe('MISS');
    expect(first.headers.get('access-control-allow-origin')).toBe('*');
    expect(await first.text()).toBe('[1]');
    const second = await t.get(KP);
    expect(second.headers.get('x-cache')).toBe('HIT');
    expect(second.headers.get('content-type')).toBe('application/json');
    expect(t.fetchUpstream).toHaveBeenCalledTimes(1);
    expect(t.kv.store.has('swpc/products/noaa-planetary-k-index.json')).toBe(true);
  });

  it('serves stale immediately and refreshes in the background', async () => {
    let body = 'old';
    const t = setup(async () => new Response(body));
    await t.get(KP);
    body = 'new';
    t.advance(11 * 60 * 1000);
    const stale = await t.get(KP);
    expect(stale.headers.get('x-cache')).toBe('STALE');
    expect(await stale.text()).toBe('old');
    await t.settle();
    expect(await (await t.get(KP)).text()).toBe('new');
  });

  it('keeps serving the last good copy when the upstream starts failing', async () => {
    let fail = false;
    const t = setup(async () => (fail ? new Response('down', { status: 503 }) : new Response('good')));
    await t.get(KP);
    fail = true;
    t.advance(60 * 60 * 1000);
    await t.get(KP);
    await t.settle();
    const response = await t.get(KP);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('good');
  });

  it('passes an upstream error through on a cold miss without caching it', async () => {
    const t = setup(async () => new Response('nope', { status: 500 }));
    const response = await t.get(KP);
    expect(response.status).toBe(500);
    expect(t.kv.store.size).toBe(0);
  });

  it('does not cache an empty 200 body', async () => {
    const t = setup(async () => new Response(''));
    await t.get('/firms/VIIRS_NOAA20_NRT/world/1');
    expect(t.kv.store.size).toBe(0);
  });

  it('answers 502 when the upstream is unreachable and nothing is cached', async () => {
    const t = setup(async () => {
      throw new Error('network');
    });
    expect((await t.get(KP)).status).toBe(502);
  });

  it('still serves from the isolate cache when KV writes are capped', async () => {
    const t = setup(async () => new Response('x'));
    t.kv.failWrites = true;
    expect((await t.get(KP)).status).toBe(200);
    expect((await t.get(KP)).headers.get('x-cache')).toBe('HIT');
    expect(t.fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it('reads entries written by another isolate from KV', async () => {
    const t = setup(async () => new Response('fresh'));
    const entry: CachedEntry = { storedAt: 1_000_000, status: 200, contentType: 'text/plain', body: 'from-kv' };
    t.kv.store.set('swpc/products/noaa-planetary-k-index.json', JSON.stringify(entry));
    expect(await (await t.get(KP)).text()).toBe('from-kv');
    expect(t.fetchUpstream).not.toHaveBeenCalled();
  });

  it('collapses concurrent misses into one upstream request', async () => {
    const t = setup(async () => new Response('x'));
    await Promise.all([t.get(KP), t.get(KP), t.get(KP)]);
    expect(t.fetchUpstream).toHaveBeenCalledTimes(1);
  });

  it('404s non-allowlisted paths, 405s non-GET, 204s preflight', async () => {
    const t = setup(async () => new Response('x'));
    expect((await t.get('/evil/x')).status).toBe(404);
    const handle = createHandler({ fetchUpstream: async () => new Response('x'), now: () => 0 });
    const env: Env = { CACHE: memoryKv() };
    const ctx = { waitUntil: () => {} };
    expect((await handle(new Request('https://p.test/swpc/products/x', { method: 'POST' }), env, ctx)).status).toBe(405);
    const preflight = await handle(new Request('https://p.test/swpc/products/x', { method: 'OPTIONS' }), env, ctx);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
  });
});
