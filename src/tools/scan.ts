import { t } from '@/i18n';
// Scan geometry and filters (pure, unit-tested): design/ScanReview.dc.html filters, page rotate/crop,
// the ID card frame -> photo mapping and the ID card page layout (design/FlowIdScan.dc.html).

export type ScanFilter = 'original' | 'clean' | 'grayscale' | 'bw';

export const SCAN_FILTERS: { value: ScanFilter; label: string }[] = [
  { value: 'original', get label() { return t('Original'); } },
  { value: 'clean', get label() { return t('Clean'); } },
  { value: 'grayscale', get label() { return t('Grayscale'); } },
  { value: 'bw', get label() { return t('B and W'); } },
];

const L = [0.299, 0.587, 0.114];

/**
 * 4x5 color matrices (rows R, G, B, A; offsets in 0-1 as Skia expects).
 * Clean: more contrast and a lift so paper turns white and ink gets darker.
 * B and W: steep contrast on luma, close to a threshold but with soft edges.
 */
export const FILTER_MATRIX: Record<ScanFilter, number[]> = {
  original: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  clean: [1.5, 0, 0, 0, -0.12, 0, 1.5, 0, 0, -0.12, 0, 0, 1.5, 0, -0.12, 0, 0, 0, 1, 0],
  grayscale: [...L, 0, 0, ...L, 0, 0, ...L, 0, 0, 0, 0, 0, 1, 0],
  bw: [...L.map((v) => v * 3.2), 0, -1.1, ...L.map((v) => v * 3.2), 0, -1.1, ...L.map((v) => v * 3.2), 0, -1.1, 0, 0, 0, 1, 0],
};

/** Applies a matrix to one RGB(A) color in 0-1 (for tests and tile previews). */
export function applyMatrix(m: number[], [r, g, b, a = 1]: number[]): number[] {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [0, 1, 2, 3].map((row) => clamp(m[row * 5] * r + m[row * 5 + 1] * g + m[row * 5 + 2] * b + m[row * 5 + 3] * a + m[row * 5 + 4]));
}

/** Crop as fractions (0-1) of the page as displayed, i.e. after rotation. */
export type Crop = { x: number; y: number; w: number; h: number };
export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };

export type Rotation = 0 | 90 | 180 | 270;
export const rotateRight = (r: Rotation): Rotation => (((r + 90) % 360) as Rotation);

/** Size of the image after rotation and crop, scaled so the long side is at most maxSide. */
export function outputSize(imgW: number, imgH: number, rotation: Rotation, crop: Crop, maxSide = Infinity) {
  const turned = rotation % 180 !== 0;
  const rw = turned ? imgH : imgW;
  const rh = turned ? imgW : imgH;
  const cw = rw * crop.w;
  const ch = rh * crop.h;
  const k = Math.min(1, maxSide / Math.max(cw, ch));
  return { rw, rh, cw, ch, k, width: Math.max(1, Math.round(cw * k)), height: Math.max(1, Math.round(ch * k)) };
}

/** Keeps a crop inside the page and at least `min` (fraction) on each side. */
export function clampCrop(c: Crop, min = 0.1): Crop {
  const w = Math.min(1, Math.max(min, c.w));
  const h = Math.min(1, Math.max(min, c.h));
  return { x: Math.min(1 - w, Math.max(0, c.x)), y: Math.min(1 - h, Math.max(0, c.y)), w, h };
}

/** Crop after turning the page 90° right: the same area of paper stays selected. */
export const rotateCropRight = (c: Crop): Crop => ({ x: 1 - c.y - c.h, y: c.x, w: c.h, h: c.w });

/**
 * A rect on a camera preview shown "cover" (filled and centered) -> the same area in the photo's pixels,
 * as fractions of the photo. Used to cut the ID card out of the photo along the on-screen frame.
 */
export function coverRectToImage(
  rect: { x: number; y: number; w: number; h: number },
  view: { w: number; h: number },
  image: { w: number; h: number },
): Crop {
  const s = Math.max(view.w / image.w, view.h / image.h);
  const offX = (image.w * s - view.w) / 2;
  const offY = (image.h * s - view.h) / 2;
  return clampCrop(
    {
      x: (rect.x + offX) / s / image.w,
      y: (rect.y + offY) / s / image.h,
      w: rect.w / s / image.w,
      h: rect.h / s / image.h,
    },
    0,
  );
}

// ---------- ID card page ----------

export type PaperSize = 'a4' | 'letter';
export const PAPER: Record<PaperSize, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };

/** ISO/IEC 7810 ID-1 card: 85.60 x 53.98 mm, in points. */
export const ID_CARD = { w: (85.6 / 25.4) * 72, h: (53.98 / 25.4) * 72 };
const ID_GAP = 36; // pt between the two sides

type Box = { x: number; y: number; w: number; h: number };

/** Card size on the page (added on request): real (85.6 x 54 mm), larger (1.4x), or as big as fits (both sides). */
export type IdSize = 'real' | 'large' | 'fit';
const ID_MARGIN = 36; // pt kept free around the page

/** How much bigger than real size the cards are drawn (never more than fits on the page). */
export function idScale(paper: PaperSize, size: IdSize = 'real'): number {
  if (size === 'real') return 1;
  const [width, height] = PAPER[paper];
  const max = Math.min((width - ID_MARGIN * 2) / ID_CARD.w, (height - ID_MARGIN * 2 - ID_GAP) / (ID_CARD.h * 2));
  return size === 'fit' ? max : Math.min(1.4, max);
}

/** Both sides, centered on the page and stacked, front on top, at the chosen size. y from the top of the page. */
export function idLayout(paper: PaperSize, size: IdSize = 'real'): { width: number; height: number; front: Box; back: Box } {
  const [width, height] = PAPER[paper];
  const k = idScale(paper, size);
  const cw = ID_CARD.w * k;
  const ch = ID_CARD.h * k;
  const total = ch * 2 + ID_GAP;
  const x = (width - cw) / 2;
  const top = (height - total) / 2;
  return {
    width,
    height,
    front: { x, y: top, w: cw, h: ch },
    back: { x, y: top + ch + ID_GAP, w: cw, h: ch },
  };
}

/** Image of aspect imgW:imgH fitted (contain) and centered in a box. */
export function fitIn(box: Box, imgW: number, imgH: number): Box {
  const k = Math.min(box.w / imgW, box.h / imgH);
  const w = imgW * k;
  const h = imgH * k;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** A4 portrait width for scanned pages; the height follows the image. */
export const SCAN_PAGE_WIDTH = 595.28;
