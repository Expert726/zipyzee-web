'use client';
// Draw on photo (the app's src/lib/drawImage.ts, Skia there), on a canvas at any size: the photo, then the drawing on
// its own layer (so the eraser clears ink, not the photo). The same item list as the editor's preview
// (src/tools/image/draw.ts), so the preview and the saved photo match.
import { HIGHLIGHT_ALPHA, strokeWidth, type DrawItem } from '@/tools/image/draw';

/** The page's own font (Poppins, with Noto Naskh for Urdu), as next/font named it. */
export const drawFont = () => (typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily || 'sans-serif');

/** Draws `items` on g at w x h (the drawing layer only). */
export function drawItems(g: CanvasRenderingContext2D, w: number, h: number, items: DrawItem[]) {
  const short = Math.min(w, h);
  const family = drawFont();
  for (const it of items) {
    g.save();
    if (it.kind === 'text') {
      g.fillStyle = it.color;
      g.font = `600 ${it.s * short}px ${family}`;
      g.textBaseline = 'alphabetic';
      g.direction = 'inherit';
      g.fillText(it.text, it.x * w, it.y * h);
      g.restore();
      continue;
    }
    if (!it.p.length) {
      g.restore();
      continue;
    }
    g.lineWidth = strokeWidth(it, short);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = it.color;
    if (it.tool === 'highlighter') g.globalAlpha = HIGHLIGHT_ALPHA;
    if (it.tool === 'eraser') g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(it.p[0][0] * w, it.p[0][1] * h);
    if (it.p.length === 1) g.lineTo(it.p[0][0] * w + 0.1, it.p[0][1] * h);
    for (const [x, y] of it.p.slice(1)) g.lineTo(x * w, y * h);
    g.stroke();
    g.restore();
  }
}

/** The photo at w x h with the drawing on it. */
export function renderDrawing(photo: HTMLCanvasElement | ImageBitmap, w: number, h: number, items: DrawItem[]): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.round(w);
  out.height = Math.round(h);
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(photo, 0, 0, out.width, out.height);
  const layer = document.createElement('canvas');
  layer.width = out.width;
  layer.height = out.height;
  drawItems(layer.getContext('2d')!, out.width, out.height, items);
  g.drawImage(layer, 0, 0);
  layer.width = layer.height = 0;
  return out;
}
