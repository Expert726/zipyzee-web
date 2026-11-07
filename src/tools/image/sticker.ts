// Copied from the app (src/tools/image/sticker.ts); keep the two the same.
// Sticker maker maths (pure, unit-tested): where the cut-out subject is, how it sits in WhatsApp's 512 x 512 sticker,
// and the WebP quality that keeps it under WhatsApp's 100 KB limit. src/tools/handlers/stickerMaker.ts draws it.

export const STICKER = 512;
/** Space around the subject (also room for the white outline). */
export const STICKER_MARGIN = 16;
export const STICKER_MAX_BYTES = 100 * 1024;

export type Rect = { x: number; y: number; w: number; h: number };

/** The box around every pixel whose alpha is above `threshold` (0-255) in RGBA pixels; null when it's all clear. */
export function alphaBounds(rgba: Uint8Array, w: number, h: number, threshold = 24): Rect | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Where `src` (the subject's box) goes in the sticker: as big as fits inside the margin, centered. */
export function stickerFit(src: Rect, size = STICKER, margin = STICKER_MARGIN): Rect {
  const room = size - margin * 2;
  const s = Math.min(room / src.w, room / src.h);
  const w = src.w * s;
  const h = src.h * s;
  return { x: (size - w) / 2, y: (size - h) / 2, w, h };
}

/** The best WebP quality whose file is at most maxBytes (encode gives the byte size); the lowest tried if none fit. */
export function webpQuality(encode: (quality: number) => number, maxBytes = STICKER_MAX_BYTES): number {
  for (const q of [90, 80, 70, 60, 50, 40, 30]) if (encode(q) <= maxBytes) return q;
  return 30;
}
