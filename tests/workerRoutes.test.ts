import { resolveRoute, toProxyPath } from '../worker/src/routes';

const secrets = { NASA_API_KEY: 'SERVERKEY', FIRMS_MAP_KEY: 'FIRMSKEY' };

describe('resolveRoute', () => {
  it('maps an allowlisted path to its upstream with the service TTL', () => {
    const route = resolveRoute('/swpc/products/noaa-planetary-k-index.json', '', secrets);
    expect(route).toEqual({
      upstreamUrl: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
      ttlSeconds: 600,
      cacheKey: 'swpc/products/noaa-planetary-k-index.json',
    });
  });

  it('uses a per-prefix TTL override', () => {
    expect(resolveRoute('/swpc/json/solar-cycle/predicted-solar-cycle.json', '', secrets)?.ttlSeconds).toBe(86400);
  });

  it('injects the NASA key and drops any key the caller sent', () => {
    const route = resolveRoute('/nasa/planetary/apod', '?api_key=CLIENT&thumbs=true', secrets);
    expect(route?.upstreamUrl).toBe('https://api.nasa.gov/planetary/apod?thumbs=true&api_key=SERVERKEY');
    expect(route?.cacheKey).toBe('nasa/planetary/apod?thumbs=true');
  });

  it('inserts the FIRMS key as a path segment', () => {
    const route = resolveRoute('/firms/VIIRS_NOAA20_NRT/world/1', '', secrets);
    expect(route?.upstreamUrl).toBe('https://firms.modaps.eosdis.nasa.gov/api/area/csv/FIRMSKEY/VIIRS_NOAA20_NRT/world/1');
    expect(route?.cacheKey).toBe('firms/VIIRS_NOAA20_NRT/world/1');
  });

  it('rejects FIRMS without a configured key or with a malformed path', () => {
    expect(resolveRoute('/firms/VIIRS_NOAA20_NRT/world/1', '', {})).toBeNull();
    expect(resolveRoute('/firms/VIIRS/world/1/extra', '', secrets)).toBeNull();
  });

  it('rejects unknown services, non-allowlisted paths and dot-dot paths', () => {
    expect(resolveRoute('/evil/anything', '', secrets)).toBeNull();
    expect(resolveRoute('/swpc/images/latest.jpg', '', secrets)).toBeNull();
    expect(resolveRoute('/swpc/products/../../etc', '', secrets)).toBeNull();
    expect(resolveRoute('/', '', secrets)).toBeNull();
    expect(resolveRoute('/__proto__/x', '', secrets)).toBeNull();
  });

  it('covers the JPL / news / exoplanet services that have no CORS upstream', () => {
    expect(resolveRoute('/jpl/fireball.api', '?limit=5', secrets)?.upstreamUrl).toBe(
      'https://ssd-api.jpl.nasa.gov/fireball.api?limit=5',
    );
    expect(resolveRoute('/jpl/sbdb_query.api', '?sb-kind=c', secrets)?.ttlSeconds).toBe(24 * 3600);
    expect(resolveRoute('/horizons/horizons.api', "?COMMAND='-31'", secrets)?.upstreamUrl).toBe(
      'https://ssd.jpl.nasa.gov/api/horizons.api?COMMAND=%27-31%27',
    );
    expect(toProxyPath("https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='-31'")).toBe(
      'horizons/horizons.api?format=json&COMMAND=%27-31%27',
    );
    expect(resolveRoute('/sfn/articles/', '', secrets)).not.toBeNull();
    expect(resolveRoute('/exoplanets/TAP/sync', '?query=x', secrets)).not.toBeNull();
  });
});

describe('toProxyPath', () => {
  it('turns a direct URL into a key-free proxy path', () => {
    expect(toProxyPath('https://api.nasa.gov/planetary/apod?api_key=CLIENT&thumbs=true')).toBe('nasa/planetary/apod?thumbs=true');
    expect(toProxyPath('https://firms.modaps.eosdis.nasa.gov/api/area/csv/CLIENTKEY/VIIRS_NOAA20_NRT/world/2')).toBe(
      'firms/VIIRS_NOAA20_NRT/world/2',
    );
    expect(toProxyPath('https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle')).toBe(
      'celestrak/gp.php?GROUP=stations&FORMAT=tle',
    );
  });

  it('returns null for URLs no service covers', () => {
    expect(toProxyPath('https://example.com/x')).toBeNull();
    expect(toProxyPath('https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg')).toBeNull();
    expect(toProxyPath('not a url')).toBeNull();
  });

  it('round-trips through resolveRoute to the same upstream (modulo the key)', () => {
    const direct = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes';
    const path = toProxyPath(direct);
    const [pathname, search] = `/${path}`.split('?');
    expect(resolveRoute(pathname, `?${search}`, secrets)?.upstreamUrl).toBe(direct);
  });
});
