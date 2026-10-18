import { toProxyPath } from '../../worker/src/routes';

// The caching proxy (worker/, see backend-plan.md): one shared cache in front
// of every upstream, so N visitors cost ~1 upstream request per TTL instead of
// N, and API keys live in worker secrets. Empty string = proxy disabled.
// VITE_PROXY_BASE overrides it for development, e.g. a local `wrangler dev`
// (`VITE_PROXY_BASE=http://localhost:8787 npm run dev`).
export const PROXY_BASE: string = import.meta.env.VITE_PROXY_BASE ?? 'https://space-radar-proxy.dmitry-weiner.workers.dev';

/** The proxy URL for a direct upstream URL, or null if no route covers it. */
export function proxyUrlFor(directUrl: string, base: string = PROXY_BASE): string | null {
  if (!base) {
    return null;
  }
  const path = toProxyPath(directUrl);
  return path === null ? null : `${base}/${path}`;
}

/**
 * Fetch through the proxy, falling back to the direct upstream URL (with the
 * client's own keys) when the proxy is unreachable or answers with an error —
 * so a proxy outage degrades to the pre-proxy behaviour instead of breaking
 * every card. If both fail, the direct attempt's outcome is what the caller
 * sees, so error messages still name the real upstream.
 */
export async function fetchViaProxy<R extends { ok: boolean }>(
  fetchFn: (url: string) => Promise<R>,
  directUrl: string,
  base: string = PROXY_BASE,
): Promise<R> {
  const proxyUrl = proxyUrlFor(directUrl, base);
  if (proxyUrl) {
    try {
      const response = await fetchFn(proxyUrl);
      if (response.ok) {
        return response;
      }
    } catch {
      // Fall through to the direct request.
    }
  }
  return fetchFn(directUrl);
}
