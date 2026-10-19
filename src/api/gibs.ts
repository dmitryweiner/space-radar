// NASA GIBS: a daily global true-colour mosaic (VIIRS) as one WMS GetMap
// image, used as the globe's 'satellite' Earth style. CORS `*`, no key.
// Data lags 1–3 days and the most recent day fills in swath by swath, so we
// start at today−2 and step back while a day is missing or obviously partial.

const WMS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
export const GIBS_TRUE_COLOR_LAYER = 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
const FIRST_LAG_DAYS = 2;
const MAX_LAG_DAYS = 5;
// A complete 2048×1024 true-colour mosaic is ~300–400 kB of JPEG; a day still
// filling in (mostly black) compresses far smaller. Scaled by pixel count for
// the data-saver 1024×512 request.
const MIN_COMPLETE_BYTES = 150 * 1024;
export const GIBS_FULL_WIDTH = 2048;
export const GIBS_SAVER_WIDTH = 1024;

export function gibsDate(now: Date, lagDays: number): string {
  return new Date(now.getTime() - lagDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function gibsSnapshotUrl(date: string, layer: string = GIBS_TRUE_COLOR_LAYER, width = 2048): string {
  // WMS 1.3.0 + EPSG:4326 takes the bbox in lat,lon axis order.
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/jpeg',
    WIDTH: String(width),
    HEIGHT: String(width / 2),
    CRS: 'EPSG:4326',
    BBOX: '-90,-180,90,180',
    TIME: date,
  });
  return `${WMS_BASE}?${params.toString()}`;
}

interface BlobResponse {
  ok: boolean;
  blob(): Promise<Blob>;
}

export interface GibsSnapshot {
  date: string;
  blob: Blob;
}

/** The newest complete daily mosaic, or null if none of the recent days is. */
export async function fetchGibsSnapshot(
  fetchFn: (url: string) => Promise<BlobResponse> = fetch,
  now: Date = new Date(),
  width: number = GIBS_FULL_WIDTH,
): Promise<GibsSnapshot | null> {
  const minBytes = MIN_COMPLETE_BYTES * (width / GIBS_FULL_WIDTH) ** 2;
  for (let lag = FIRST_LAG_DAYS; lag <= MAX_LAG_DAYS; lag += 1) {
    const date = gibsDate(now, lag);
    try {
      const response = await fetchFn(gibsSnapshotUrl(date, GIBS_TRUE_COLOR_LAYER, width));
      if (!response.ok) {
        continue;
      }
      const blob = await response.blob();
      if (blob.size >= minBytes) {
        return { date, blob };
      }
    } catch {
      // Network error — try an older day.
    }
  }
  return null;
}

// VIIRS "Black Marble" night lights — a static composite (no TIME), ~110 kB.
export function gibsNightLightsUrl(width: number = GIBS_FULL_WIDTH): string {
  return `${WMS_BASE}?${new URLSearchParams({
  SERVICE: 'WMS',
  REQUEST: 'GetMap',
  VERSION: '1.3.0',
  LAYERS: 'VIIRS_Black_Marble',
  STYLES: '',
  FORMAT: 'image/jpeg',
  WIDTH: String(width),
  HEIGHT: String(width / 2),
  CRS: 'EPSG:4326',
  BBOX: '-90,-180,90,180',
}).toString()}`;
}
