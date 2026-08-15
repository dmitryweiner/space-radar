// Minimal PNG decoder (8-bit depth only) + perceptual pixel-diff counter for
// Playwright screenshot comparisons. Exact-byte `Buffer.equals()` is too
// sensitive for canvases with transparent/blended content (label sprites,
// wireframe grids): the headless-Chromium software rasterizer produces small
// frame-to-frame dithering noise there independent of any real scene change,
// so two screenshots of a genuinely static canvas can still differ by a few
// bytes. countDiffPixels() instead counts pixels whose channel values moved
// by more than `tolerance`, giving a real magnitude to threshold against —
// noise floor is a handful of pixels; real motion is thousands (see
// scripts/smoke.mjs's 'auto-rotate' section for the calibrated thresholds).
import zlib from 'node:zlib';

function readChunks(buf) {
  let offset = 8; // skip signature
  const chunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    chunks.push({ type, data });
    offset += 12 + len;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr.readUInt8(8);
  const colorType = ihdr.readUInt8(9);
  if (bitDepth !== 8) throw new Error(`unsupported bitDepth ${bitDepth}`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bpp = channels;
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let rawOffset = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset]; rawOffset += 1;
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rawOffset + x];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = y > 0 ? out[prevRowStart + x] : 0;
      const c = y > 0 && x >= bpp ? out[prevRowStart + x - bpp] : 0;
      let value;
      switch (filterType) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + a; break;
        case 2: value = rawByte + b; break;
        case 3: value = rawByte + Math.floor((a + b) / 2); break;
        case 4: value = rawByte + paeth(a, b, c); break;
        default: throw new Error(`unsupported filter ${filterType}`);
      }
      out[rowStart + x] = value & 0xff;
    }
    rawOffset += stride;
  }
  return { width, height, bpp, pixels: out };
}

// Count pixels whose channel values differ by more than `tolerance` in any channel.
export function countDiffPixels(bufA, bufB, tolerance = 8) {
  const a = decodePng(bufA);
  const b = decodePng(bufB);
  if (a.width !== b.width || a.height !== b.height || a.bpp !== b.bpp) {
    return Math.max(a.width * a.height, b.width * b.height);
  }
  let diff = 0;
  const total = a.width * a.height;
  for (let p = 0; p < total; p++) {
    const base = p * a.bpp;
    let changed = false;
    for (let ch = 0; ch < a.bpp; ch++) {
      if (Math.abs(a.pixels[base + ch] - b.pixels[base + ch]) > tolerance) {
        changed = true;
        break;
      }
    }
    if (changed) diff++;
  }
  return diff;
}
