import { t } from '@/i18n';
// Copied from the app (src/tools/image/blur.ts); keep the two the same.
// Blur faces (pure, unit-tested) — design/FlowBlurImage.dc.html: face boxes from ML Kit, manual boxes,
// Style (Blur / Pixelate / Black box) and Strength (Light / Medium / Strong).

/** Fractions (0-1) of the photo as displayed. */
export type Box = { x: number; y: number; w: number; h: number };

export type HideStyle = 'blur' | 'pixelate' | 'black';

export const strengthLabels = () => [t('Light'), t('Medium'), t('Strong')] as const;

/**
 * For blur: the blur radius (sigma); for pixelate: the block size. Both in px, relative to the box's short side,
 * so the look doesn't depend on the photo's resolution. strength 1-3.
 */
export function hideStrength(style: HideStyle, strength: number, side: number): number {
  const i = Math.min(3, Math.max(1, Math.round(strength))) - 1;
  if (style === 'blur') return side * [0.06, 0.11, 0.18][i];
  return side / [10, 7, 4.5][i];
}

/** A face frame in photo pixels -> a box with some room around it (hair, chin), kept inside the photo. */
export function faceBox(frame: { left: number; top: number; width: number; height: number }, img: { w: number; h: number }, pad = 0.18): Box {
  const x = Math.max(0, frame.left - frame.width * pad);
  const y = Math.max(0, frame.top - frame.height * pad * 1.4);
  const r = Math.min(img.w, frame.left + frame.width * (1 + pad));
  const b = Math.min(img.h, frame.top + frame.height * (1 + pad));
  return { x: x / img.w, y: y / img.h, w: (r - x) / img.w, h: (b - y) / img.h };
}

/** A box from a drag between two points (fractions), or null when too small to mean anything. */
export function dragBox(x0: number, y0: number, x1: number, y1: number, min = 0.04): Box | null {
  const x = Math.max(0, Math.min(x0, x1));
  const y = Math.max(0, Math.min(y0, y1));
  const w = Math.min(1, Math.max(x0, x1)) - x;
  const h = Math.min(1, Math.max(y0, y1)) - y;
  return w < min || h < min ? null : { x, y, w, h };
}

/** Index of the last box containing the point (the one drawn on top), or -1. */
export function boxAt(boxes: Box[], px: number, py: number): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return i;
  }
  return -1;
}

// ---------- Brush (added on request): paint over anything to hide it ----------

/** A brush stroke in 0-1 of the photo; s = brush size as a share of the photo's short side (like Object eraser). */
export type HideStroke = { s: number; p: [number, number][] };

/** Painted areas get one strength for the whole photo (a quarter of its short side counts as the "box"). */
export const brushStrength = (style: HideStyle, strength: number, w: number, h: number) => hideStrength(style, strength, Math.min(w, h) * 0.25);

// ---------- Undo / Redo ----------

/** Everything the person changed by hand: faces taken off, boxes drawn, brush strokes. */
export type BlurEdits = { removed: number[]; manual: Box[]; strokes: HideStroke[] };
export type BlurHistory = { past: BlurEdits[]; now: BlurEdits; future: BlurEdits[] };

export const startHistory = (now: BlurEdits): BlurHistory => ({ past: [], now, future: [] });
/** A new edit: the old state can be undone, and anything undone before can't be redone any more. */
export const commit = (h: BlurHistory, next: BlurEdits): BlurHistory => ({ past: [...h.past, h.now], now: next, future: [] });
export const undo = (h: BlurHistory): BlurHistory =>
  h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h;
export const redo = (h: BlurHistory): BlurHistory =>
  h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h;
