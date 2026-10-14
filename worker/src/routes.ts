// The proxy's whole routing table, as pure data + pure functions (no I/O) so
// it is unit-tested in the normal `npm run check` run and shared verbatim by
// the client (`src/api/proxy.ts` maps a direct upstream URL to its proxy path
// with this same table, so the two can't drift apart).
//
// Request shape: `/{service}/{path}?{query}` → `{upstream}{path}?{query}`.
// Only allowlisted path prefixes are proxied — anything else is a 404, so this
// is not an open proxy for the whole internet. API keys never travel from the
// client: the worker strips any `api_key` the caller sent and inserts its own
// secret (NASA as a query param, FIRMS as a path segment).

export interface PathRule {
  prefix: string;
  /** Overrides the service TTL for this prefix. */
  ttlSeconds?: number;
  /** Optional stricter shape check on the full path (after the prefix). */
  pattern?: RegExp;
}

export interface ServiceRoute {
  /** Upstream base URL, ending in `/`. */
  upstream: string;
  ttlSeconds: number;
  paths: PathRule[];
  /** How the worker injects its secret, if this service needs one. */
  key?: 'nasa-query' | 'firms-path';
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// TTLs follow each source's update cadence and limits. They also bound KV
// writes (free tier: 1,000/day) — at most one write per endpoint per TTL — so
// nothing here is shorter than 10 minutes.
export const SERVICES: Record<string, ServiceRoute> = {
  swpc: {
    upstream: 'https://services.swpc.noaa.gov/',
    ttlSeconds: 10 * MINUTE,
    paths: [{ prefix: 'json/solar-cycle/', ttlSeconds: DAY }, { prefix: 'products/' }, { prefix: 'json/' }],
  },
  celestrak: {
    upstream: 'https://celestrak.org/NORAD/elements/',
    ttlSeconds: 3 * HOUR,
    paths: [{ prefix: 'gp.php' }],
  },
  nasa: {
    upstream: 'https://api.nasa.gov/',
    ttlSeconds: HOUR,
    key: 'nasa-query',
    paths: [{ prefix: 'planetary/apod' }, { prefix: 'neo/rest/v1/feed' }, { prefix: 'DONKI/' }],
  },
  firms: {
    upstream: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/',
    ttlSeconds: 30 * MINUTE,
    key: 'firms-path',
    // {source}/{area}/{days} — area is "world" or "w,s,e,n".
    paths: [{ prefix: '', pattern: /^[A-Z0-9_]+\/(world|[-\d.,]+)\/\d{1,2}$/ }],
  },
  eonet: {
    upstream: 'https://eonet.gsfc.nasa.gov/api/v3/',
    ttlSeconds: 30 * MINUTE,
    paths: [{ prefix: 'events' }],
  },
  epic: {
    upstream: 'https://epic.gsfc.nasa.gov/api/',
    ttlSeconds: HOUR,
    paths: [{ prefix: 'natural' }, { prefix: 'enhanced' }],
  },
  // Launch Library 2's free tier is 15 requests/hour per IP for *all*
  // endpoints together — a shared hour-long cache is the whole point here.
  ll2: {
    upstream: 'https://ll.thespacedevs.com/2.2.0/',
    ttlSeconds: HOUR,
    paths: [{ prefix: 'launch/upcoming' }, { prefix: 'astronaut' }, { prefix: 'event/upcoming' }, { prefix: 'spacestation' }],
  },
  usgs: {
    upstream: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/',
    ttlSeconds: 10 * MINUTE,
    paths: [{ prefix: 'summary/' }],
  },
  'nasa-images': {
    upstream: 'https://images-api.nasa.gov/',
    ttlSeconds: DAY,
    paths: [{ prefix: 'search' }],
  },
  // No CORS headers upstream — these are only reachable from the browser
  // through this proxy.
  jpl: {
    upstream: 'https://ssd-api.jpl.nasa.gov/',
    ttlSeconds: HOUR,
    paths: [
      { prefix: 'cad.api' },
      { prefix: 'fireball.api', ttlSeconds: 6 * HOUR },
      { prefix: 'sentry.api', ttlSeconds: DAY },
      { prefix: 'sbdb.api', ttlSeconds: DAY },
    ],
  },
  sfn: {
    upstream: 'https://api.spaceflightnewsapi.net/v4/',
    ttlSeconds: 30 * MINUTE,
    paths: [{ prefix: 'articles' }, { prefix: 'blogs' }, { prefix: 'reports' }],
  },
  exoplanets: {
    upstream: 'https://exoplanetarchive.ipac.caltech.edu/',
    ttlSeconds: DAY,
    paths: [{ prefix: 'TAP/sync' }],
  },
};

export interface Secrets {
  NASA_API_KEY?: string;
  FIRMS_MAP_KEY?: string;
}

export interface ResolvedRoute {
  upstreamUrl: string;
  ttlSeconds: number;
  /** Key-free, so it's safe to log and identical for every caller. */
  cacheKey: string;
}

function matchRule(route: ServiceRoute, path: string): PathRule | null {
  // `..` can't climb out of the upstream base once URL-joined, but reject it
  // outright rather than reason about each upstream's path handling.
  if (path.includes('..')) {
    return null;
  }
  for (const rule of route.paths) {
    if (path.startsWith(rule.prefix) && (!rule.pattern || rule.pattern.test(path))) {
      return rule;
    }
  }
  return null;
}

/** `/{service}/{path}` + `?query` → the upstream request, or null (404). */
export function resolveRoute(pathname: string, search: string, secrets: Secrets): ResolvedRoute | null {
  const match = /^\/([a-z0-9-]+)\/(.*)$/.exec(pathname);
  if (!match) {
    return null;
  }
  const [, service, path] = match;
  if (!Object.prototype.hasOwnProperty.call(SERVICES, service)) {
    return null;
  }
  const route = SERVICES[service];
  const rule = matchRule(route, path);
  if (!rule) {
    return null;
  }

  const params = new URLSearchParams(search);
  params.delete('api_key');
  const query = params.toString();
  const cacheKey = `${service}/${path}${query ? `?${query}` : ''}`;

  let upstreamPath = path;
  if (route.key === 'nasa-query') {
    params.set('api_key', secrets.NASA_API_KEY || 'DEMO_KEY');
  } else if (route.key === 'firms-path') {
    if (!secrets.FIRMS_MAP_KEY) {
      return null;
    }
    upstreamPath = `${secrets.FIRMS_MAP_KEY}/${path}`;
  }
  const upstreamQuery = params.toString();
  return {
    upstreamUrl: `${route.upstream}${upstreamPath}${upstreamQuery ? `?${upstreamQuery}` : ''}`,
    ttlSeconds: rule.ttlSeconds ?? route.ttlSeconds,
    cacheKey,
  };
}

/**
 * Client side: a direct upstream URL (possibly carrying the client's own
 * fallback key) → the key-free `{service}/{path}?{query}` proxy path, or null
 * when no service covers it (the caller then just goes direct).
 */
export function toProxyPath(directUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(directUrl);
  } catch {
    return null;
  }
  const bare = `${url.origin}${url.pathname}`;
  for (const [service, route] of Object.entries(SERVICES)) {
    if (!bare.startsWith(route.upstream)) {
      continue;
    }
    let path = bare.slice(route.upstream.length);
    if (route.key === 'firms-path') {
      // Drop the leading MAP_KEY segment; the worker inserts its own.
      path = path.split('/').slice(1).join('/');
    }
    if (!matchRule(route, path)) {
      return null;
    }
    const params = new URLSearchParams(url.search);
    params.delete('api_key');
    const query = params.toString();
    return `${service}/${path}${query ? `?${query}` : ''}`;
  }
  return null;
}
