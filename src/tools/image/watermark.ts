// Image watermark placement (pure, unit-tested) — design/FlowImageWatermark.dc.html: Corner / Center / Tiled.
// Sizes are shares of the photo, so the preview and the full-size photo look the same.

export type WatermarkPosition = 'corner' | 'center' | 'tiled';

/** Text height (px) for a photo: corner text is small, centered text big, tiles in between. */
export function watermarkTextSize(imgW: number, imgH: number, position: WatermarkPosition) {
  const short = Math.min(imgW, imgH);
  return short * (position === 'corner' ? 0.05 : position === 'center' ? 0.1 : 0.06);
}

/** Logo width (px) for a photo. */
export function watermarkLogoWidth(imgW: number, position: WatermarkPosition) {
  return imgW * (position === 'corner' ? 0.2 : position === 'center' ? 0.45 : 0.18);
}

/** Margin from the edges for the corner mark (board: 14 / 12 px on a 350 px preview, ~4%). */
export const cornerMargin = (imgW: number) => imgW * 0.04;

export type Placement = { x: number; y: number; angle: number };

/**
 * Top-left corners for a mark of w x h on an imgW x imgH photo. Corner: bottom-right. Center: middle.
 * Tiled: a staggered grid at -30°, enough to cover the photo after rotating (angle in degrees).
 */
export function watermarkPlacements(imgW: number, imgH: number, w: number, h: number, position: WatermarkPosition): Placement[] {
  if (position === 'corner') {
    const m = cornerMargin(imgW);
    return [{ x: imgW - m - w, y: imgH - m - h, angle: 0 }];
  }
  if (position === 'center') return [{ x: (imgW - w) / 2, y: (imgH - h) / 2, angle: 0 }];
  const stepX = w * 1.6;
  const stepY = Math.max(h * 3, w * 0.7);
  const out: Placement[] = [];
  const reach = Math.hypot(imgW, imgH);
  for (let row = 0, y = -reach / 2; y < imgH + reach / 2; row++, y += stepY) {
    for (let x = -reach / 2 + (row % 2 ? stepX / 2 : 0); x < imgW + reach / 2; x += stepX) {
      out.push({ x, y, angle: -30 });
    }
  }
  return out;
}
