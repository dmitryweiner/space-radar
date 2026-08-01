// NASA FIRMS (Fire Information for Resource Management System) MAP_KEY.
// Unlike the api.nasa.gov key, FIRMS issues a separate free MAP_KEY — get one
// instantly at https://firms.modaps.eosdis.nasa.gov/api/map_key/ and paste it
// here. Like the NASA key, this ships in the public client bundle; FIRMS keys
// only rate-limit the caller and aren't tied to billing.
//
// NOTE: FIRMS did not send CORS headers in our testing, so a browser request
// from a static site may be blocked regardless of the key. If the Fire Map
// card shows a network/CORS error, the data needs to be proxied through a
// small server (or a serverless function) that adds `Access-Control-Allow-Origin`.
export const FIRMS_MAP_KEY = '';
