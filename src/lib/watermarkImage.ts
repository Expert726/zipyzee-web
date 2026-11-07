'use client';
// Image watermark drawing, shared by the live preview (components/flow/previews/ImageWatermarkPreview) and the saved
// photo (handlers/watermarks.ts), so what you see is what you get. Placement and sizes: the app's
// src/tools/image/watermark.ts (shares of the photo); the web adds a size, a text colour and all four corners.
import { watermarkLogoWidth, watermarkPlacements, watermarkTextSize, type Placement } from '@/tools/image/watermark';

export type WmPosition = 'corner' | 'bl' | 'tr' | 'tl' | 'center' | 'tiled';
export type ImageWm = { text: string; logo: ImageBitmap | null; opacity: number; position: WmPosition; size: number; color: string };

/** The options as the handler and the preview read them. */
export function readImageWm(o: Record<string, unknown>, logo: ImageBitmap | null): ImageWm {
  return {
    text: String(o.text ?? '').trim(),
    logo: o.type === 'logo' ? logo : null,
    opacity: Math.max(0, Math.min(1, Number(o.opacity ?? 80) / 100)),
    position: (o.position ?? 'corner') as WmPosition,
    size: Math.max(0.2, Math.min(4, Number(o.size ?? 100) / 100)),
    color: String(o.color ?? '#FFFFFF'),
  };
}

/** Bright text gets a dark shadow (readable on light photos), dark text a light one. */
function shadowFor(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.45)';
}

/** The app's placements; the other three corners are the bottom-right one mirrored. */
function placements(w: number, h: number, mw: number, mh: number, pos: WmPosition): Placement[] {
  const base = pos === 'center' || pos === 'tiled' ? pos : 'corner';
  return watermarkPlacements(w, h, mw, mh, base).map((p) => ({
    ...p,
    x: pos === 'bl' || pos === 'tl' ? w - p.x - mw : p.x,
    y: pos === 'tr' || pos === 'tl' ? h - p.y - mh : p.y,
  }));
}

function turned(g: CanvasRenderingContext2D, p: Placement, w: number, h: number, draw: () => void) {
  g.save();
  if (p.angle) {
    g.translate(p.x + w / 2, p.y + h / 2);
    g.rotate((p.angle * Math.PI) / 180);
    g.translate(-(p.x + w / 2), -(p.y + h / 2));
  }
  draw();
  g.restore();
}

/** Draws the watermark over a w x h photo already on g. */
export function drawImageWatermark(g: CanvasRenderingContext2D, w: number, h: number, wm: ImageWm) {
  const base = wm.position === 'center' || wm.position === 'tiled' ? wm.position : 'corner';
  g.save();
  g.globalAlpha = wm.opacity;
  if (wm.logo) {
    const lw = Math.min(w * 0.95, watermarkLogoWidth(w, base) * wm.size);
    const lh = (lw * wm.logo.height) / wm.logo.width;
    for (const p of placements(w, h, lw, lh, wm.position)) turned(g, p, lw, lh, () => g.drawImage(wm.logo!, p.x, p.y, lw, lh));
  } else if (wm.text) {
    const size = watermarkTextSize(w, h, base) * wm.size;
    g.font = `600 ${size}px Poppins, system-ui, sans-serif`;
    g.textBaseline = 'top';
    const tw = g.measureText(wm.text).width;
    for (const p of placements(w, h, tw, size, wm.position)) {
      turned(g, p, tw, size, () => {
        g.shadowColor = shadowFor(wm.color);
        g.shadowBlur = size * 0.16;
        g.shadowOffsetY = size * 0.04;
        g.fillStyle = wm.color;
        g.fillText(wm.text, p.x, p.y);
      });
    }
  }
  g.restore();
}
