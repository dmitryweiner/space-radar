// Space Radar caching proxy (Cloudflare Worker). A dumb, format-agnostic cache
// over the allowlisted upstreams in routes.ts — all parsing stays in the
// client's src/api, so changing a card never requires redeploying this.
//
// Cache: Workers KV (Cache API is a no-op on *.workers.dev) with a module-scope
// Map in front of it per isolate. Stale-while-revalidate: an expired entry is
// served immediately and refreshed in the background; if the upstream then
// fails, the last good response keeps being served. KV writes are best-effort
// — on the free tier they're capped at 1,000/day, and once that's hit the
// in-isolate cache still shields the upstreams.
import { resolveRoute, type Secrets } from './routes';

// The tiny slice of the Workers runtime types this file uses — declared here
// instead of depending on @cloudflare/workers-types, so the app's own tsc run
// (which also type-checks this directory) needs no extra ambient types.
export interface KvNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface Env extends Secrets {
  CACHE: KvNamespace;
}

export interface CachedEntry {
  storedAt: number;
  status: number;
  contentType: string;
  body: string;
}

// KV values cap at 25 MiB; stay clear of it (the largest real response, the
// CelesTrak "active" TLE group, is ~3 MB).
const MAX_CACHED_BYTES = 20 * 1024 * 1024;
// Bounded so one long-lived isolate can't grow without limit.
const MEMORY_ENTRIES = 64;

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEntry(raw: string | null): CachedEntry | null {
  if (!raw) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (
      isRecord(value) &&
      typeof value.storedAt === 'number' &&
      typeof value.status === 'number' &&
      typeof value.contentType === 'string' &&
      typeof value.body === 'string'
    ) {
      return { storedAt: value.storedAt, status: value.status, contentType: value.contentType, body: value.body };
    }
  } catch {
    // Corrupt entry — treat as a miss.
  }
  return null;
}

function respond(entry: CachedEntry, cacheState: string, ttlSeconds: number): Response {
  return new Response(entry.body, {
    status: entry.status,
    headers: {
      ...CORS_HEADERS,
      'content-type': entry.contentType,
      'x-cache': cacheState,
      // A little browser caching on top; the client keeps its own
      // localStorage cache for anything longer.
      'cache-control': `public, max-age=${Math.min(ttlSeconds, 300)}`,
    },
  });
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

export interface HandlerDeps {
  fetchUpstream: (url: string) => Promise<Response>;
  now: () => number;
}

export function createHandler({ fetchUpstream, now }: HandlerDeps) {
  const memory = new Map<string, CachedEntry>();
  // One refresh per key at a time, so a burst of stale hits doesn't stampede
  // the upstream (or burn LL2's 15 requests/hour).
  const inFlight = new Map<string, Promise<CachedEntry | null>>();

  function remember(key: string, entry: CachedEntry) {
    memory.delete(key);
    memory.set(key, entry);
    if (memory.size > MEMORY_ENTRIES) {
      const oldest = memory.keys().next().value;
      if (oldest !== undefined) {
        memory.delete(oldest);
      }
    }
  }

  async function refresh(env: Env, key: string, upstreamUrl: string): Promise<CachedEntry | null> {
    const pending = inFlight.get(key);
    if (pending) {
      return pending;
    }
    const task = (async () => {
      try {
        const upstream = await fetchUpstream(upstreamUrl);
        const body = await upstream.text();
        const entry: CachedEntry = {
          storedAt: now(),
          status: upstream.status,
          contentType: upstream.headers.get('content-type') ?? 'application/octet-stream',
          body,
        };
        // Errors and empty 200s (FIRMS answers an exhausted key with an
        // empty body) are handed back so a cold miss can pass them through,
        // but never cached over a good entry.
        if (!upstream.ok || body.length === 0) {
          return entry;
        }
        remember(key, entry);
        if (body.length <= MAX_CACHED_BYTES) {
          try {
            await env.CACHE.put(key, JSON.stringify(entry));
          } catch {
            // Free-tier daily write cap (or a transient KV error) — the
            // in-isolate copy still serves until the next refresh.
          }
        }
        return entry;
      } catch {
        return null;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    return task;
  }

  return async function handle(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'GET') {
      return errorResponse(405, 'Only GET is supported.');
    }
    const url = new URL(request.url);
    const route = resolveRoute(url.pathname, url.search, env);
    if (!route) {
      return errorResponse(404, 'Not an allowlisted upstream path.');
    }
    const { cacheKey, upstreamUrl, ttlSeconds } = route;

    let cached = memory.get(cacheKey) ?? null;
    if (!cached) {
      cached = parseEntry(await env.CACHE.get(cacheKey, 'text').catch(() => null));
      if (cached) {
        remember(cacheKey, cached);
      }
    }

    if (cached) {
      const fresh = now() - cached.storedAt < ttlSeconds * 1000;
      if (!fresh) {
        ctx.waitUntil(refresh(env, cacheKey, upstreamUrl));
      }
      return respond(cached, fresh ? 'HIT' : 'STALE', ttlSeconds);
    }

    const entry = await refresh(env, cacheKey, upstreamUrl);
    if (!entry) {
      return errorResponse(502, 'Upstream unreachable.');
    }
    return respond(entry, 'MISS', ttlSeconds);
  };
}

// Some upstreams reject requests with no User-Agent at all.
const USER_AGENT = 'space-radar-proxy (+https://github.com/dmitryweiner/space-radar)';

const handle = createHandler({
  fetchUpstream: (url) => fetch(url, { headers: { 'user-agent': USER_AGENT } }),
  now: () => Date.now(),
});

export default {
  fetch: handle,
};
