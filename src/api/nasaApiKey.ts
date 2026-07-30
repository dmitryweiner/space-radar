// A personal api.nasa.gov key (1000 requests/hour, no daily cap) rather than
// the shared DEMO_KEY (30 requests/hour, 50/day). This is a client-only
// static site with no backend, so this key is visible in the public JS
// bundle to anyone who inspects the deployed site — same as it would be for
// any purely client-side app. api.nasa.gov keys are meant to be used this
// way: they only identify a caller for rate-limiting, and aren't tied to
// billing or account access, so that exposure is expected and low-risk.
export const NASA_API_KEY = 'M25DzszkjzGTAg1MhtrZTJ0xcvCdxohjv0VV31dM';
