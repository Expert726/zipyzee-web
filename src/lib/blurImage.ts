'use client';
// Hides parts of a photo (Blur faces; the app's src/lib/blurImage.ts, Skia there), on a canvas: blur, pixelate or
// a black box, in rounded boxes and along brush strokes. Boxes and strokes are fractions of the photo and the effect
// scales with them, so the preview matches the saved photo. Blur is done by shrinking the area and stretching it
// back (smoothly, twice), which works in every browser and can't be undone like a light filter blur.
import { hideStrength, type Box, type HideStroke, type HideStyle } from '@/tools/image/blur';

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

type Rect = { x: number; y: number; w: number; h: number };

/** Draws the hidden version of `area` (canvas px) with effect size s on g (the caller clips it). */
function drawEffect(g: CanvasRenderingContext2D, src: HTMLCanvasElement, area: Rect, style: HideStyle, s: number) {
  if (style === 'black') {
    g.fillStyle = '#111827';
    g.fillRect(area.x, area.y, area.w, area.h);
    return;
  }
  if (style === 'pixelate') {
    const cols = Math.max(2, Math.round(area.w / s));
    const rows = Math.max(2, Math.round(area.h / s));
    const tiny = canvas(cols, rows);
    const tg = tiny.getContext('2d')!;
    tg.imageSmoothingQuality = 'high';
    tg.drawImage(src, area.x, area.y, area.w, area.h, 0, 0, cols, rows);
    g.imageSmoothingEnabled = false;
    g.drawImage(tiny, area.x, area.y, area.w, area.h);
    g.imageSmoothingEnabled = true;
    return;
  }
  // blur: the area with a margin (so its edges blur into their surroundings), shrunk to about one pixel per sigma
  const m = s * 2;
  const x0 = Math.max(0, area.x - m);
  const y0 = Math.max(0, area.y - m);
  const x1 = Math.min(src.width, area.x + area.w + m);
  const y1 = Math.min(src.height, area.y + area.h + m);
  const k = Math.max(1, s * 0.9);
  const tiny = canvas((x1 - x0) / k, (y1 - y0) / k);
  const mid = canvas(tiny.width * 3, tiny.height * 3);
  const tg = tiny.getContext('2d')!;
  tg.imageSmoothingQuality = 'high';
  tg.drawImage(src, x0, y0, x1 - x0, y1 - y0, 0, 0, tiny.width, tiny.height);
  const mg = mid.getContext('2d')!;
  mg.imageSmoothingQuality = 'high';
  mg.drawImage(tiny, 0, 0, mid.width, mid.height);
  g.imageSmoothingQuality = 'high';
  g.drawImage(mid, x0, y0, x1 - x0, y1 - y0);
}

/** The photo at w x h with every box and brush stroke hidden. */
export function renderHidden(photo: HTMLCanvasElement | ImageBitmap, w: number, h: number, boxes: Box[], style: HideStyle, strength: number, strokes: HideStroke[] = []): HTMLCanvasElement {
  const out = canvas(w, h);
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(photo, 0, 0, out.width, out.height);
  // every effect reads the untouched photo
  const src = canvas(out.width, out.height);
  src.getContext('2d')!.drawImage(out, 0, 0);

  for (const b of boxes) {
    const r = { x: b.x * out.width, y: b.y * out.height, w: b.w * out.width, h: b.h * out.height };
    const side = Math.min(r.w, r.h);
    g.save();
    g.beginPath();
    g.roundRect(r.x, r.y, r.w, r.h, side * 0.12);
    g.clip();
    drawEffect(g, src, r, style, hideStrength(style, strength, side));
    g.restore();
  }

  if (strokes.some((st) => st.p.length)) {
    // the effect over the whole photo, kept only under the strokes
    const layer = canvas(out.width, out.height);
    const lg = layer.getContext('2d')!;
    // exactly as strong as a box: the box a click adds in Box mode (18% of the short side, BlurEditor spotAt), or one
    // as big as the widest stroke if that's bigger, so the brush and the boxes look the same
    const short = Math.min(out.width, out.height);
    const widest = Math.max(...strokes.map((st) => st.s)) * short;
    const s = hideStrength(style, strength, Math.max(short * 0.18, widest));
    drawEffect(lg, src, { x: 0, y: 0, w: out.width, h: out.height }, style, s);
    // every stroke into one mask first, then cut the layer once: cutting per stroke kept only where ALL strokes
    // overlap, so painting a second place wiped the first (2026-11-07)
    const mask = canvas(out.width, out.height);
    const mg = mask.getContext('2d')!;
    mg.lineCap = 'round';
    mg.lineJoin = 'round';
    mg.strokeStyle = '#000';
    for (const st of strokes) {
      if (!st.p.length) continue;
      mg.lineWidth = st.s * short;
      mg.beginPath();
      mg.moveTo(st.p[0][0] * out.width, st.p[0][1] * out.height);
      if (st.p.length === 1) mg.lineTo(st.p[0][0] * out.width + 0.1, st.p[0][1] * out.height);
      for (const [x, y] of st.p.slice(1)) mg.lineTo(x * out.width, y * out.height);
      mg.stroke();
    }
    lg.globalCompositeOperation = 'destination-in';
    lg.drawImage(mask, 0, 0);
    g.drawImage(layer, 0, 0);
    layer.width = layer.height = mask.width = mask.height = 0;
  }
  src.width = src.height = 0;
  return out;
}
