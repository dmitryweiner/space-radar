import { useEffect, useState } from 'react';
import { GIBS_FULL_WIDTH, GIBS_SAVER_WIDTH, fetchGibsSnapshot } from '../api/gibs';
import earthTextureUrl from '../assets/earth-diffuse.jpg';

// A daily GIBS mosaic has pure-black no-data gaps between orbit swaths (wide
// wedges near the equator). Composite it over the static photo texture so a
// gap shows yesterday's-ish blue marble instead of a black hole.
const NO_DATA_MAX_SUM = 12;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image failed to load: ${src}`));
    image.src = src;
  });
}

async function composite(snapshot: Blob): Promise<string> {
  const snapshotUrl = URL.createObjectURL(snapshot);
  try {
    const [base, top] = await Promise.all([loadImage(earthTextureUrl), loadImage(snapshotUrl)]);
    const canvas = document.createElement('canvas');
    canvas.width = top.naturalWidth;
    canvas.height = top.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return URL.createObjectURL(snapshot);
    }
    context.drawImage(top, 0, 0);
    const fresh = context.getImageData(0, 0, canvas.width, canvas.height);
    context.drawImage(base, 0, 0, canvas.width, canvas.height);
    const merged = context.getImageData(0, 0, canvas.width, canvas.height);
    const a = fresh.data;
    const out = merged.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] + a[i + 1] + a[i + 2] > NO_DATA_MAX_SUM) {
        out[i] = a[i];
        out[i + 1] = a[i + 1];
        out[i + 2] = a[i + 2];
      }
    }
    context.putImageData(merged, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return URL.createObjectURL(blob ?? snapshot);
  } finally {
    URL.revokeObjectURL(snapshotUrl);
  }
}

// One download per page load (per size), shared by every globe that wants the
// 'satellite' style (object URL kept for the page's lifetime).
const textureUrls = new Map<number, Promise<string | null>>();

function loadTextureUrl(width: number): Promise<string | null> {
  let url = textureUrls.get(width);
  if (!url) {
    url = fetchGibsSnapshot(fetch, new Date(), width)
      .then((snapshot) => (snapshot ? composite(snapshot.blob) : null))
      .catch(() => null);
    textureUrls.set(width, url);
  }
  return url;
}

/** Object URL of the latest GIBS mosaic once `enabled` and loaded, else null.
 * `small` (data saver) fetches a 1024×512 mosaic instead of 2048×1024. */
export function useGibsTexture(enabled: boolean, small = false): string | null {
  const width = small ? GIBS_SAVER_WIDTH : GIBS_FULL_WIDTH;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    loadTextureUrl(width).then((value) => {
      if (!cancelled) {
        setUrl(value);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, width]);
  return enabled ? url : null;
}
