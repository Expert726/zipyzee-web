// Passport photo drawing (the app's src/lib/passportImage.ts, with canvas instead of Skia): the person (cut out by the
// subject mask, or the whole photo without one) cropped around the face onto the chosen background, and the print
// sheet. Geometry: the app's src/tools/image/passport.ts.
import { sheetLayout, SHEETS, type Box, type PassportSize, type PrintSheet } from '@/tools/image/passport';

/** `crop` is in pixels of `photo`; parts of it outside the photo show the background. */
export function renderPassport(photo: HTMLCanvasElement, mask: Uint8ClampedArray | null, crop: Box, w: number, h: number, bg: string): HTMLCanvasElement {
  let subject: HTMLCanvasElement = photo;
  if (mask) {
    subject = document.createElement('canvas');
    subject.width = photo.width;
    subject.height = photo.height;
    const g = subject.getContext('2d')!;
    g.drawImage(photo, 0, 0);
    const px = g.getImageData(0, 0, photo.width, photo.height);
    for (let i = 0; i < mask.length; i++) px.data[i * 4 + 3] = mask[i];
    g.putImageData(px, 0, 0);
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  const k = w / crop.w; // output px per photo px
  g.drawImage(subject, -crop.x * k, -crop.y * k, photo.width * k, photo.height * k);
  return out;
}

/** The sheet at 300 dpi with the photo repeated edge to edge and thin gray cut lines. */
export function renderSheet(photo: HTMLCanvasElement, size: PassportSize, sheet: PrintSheet = '4x6'): { canvas: HTMLCanvasElement; count: number } {
  const dpi = 300 / 72;
  const paper = SHEETS[sheet];
  const c = document.createElement('canvas');
  c.width = Math.round(paper.w * dpi);
  c.height = Math.round(paper.h * dpi);
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#D1D5DB';
  g.lineWidth = 2;
  const boxes = sheetLayout(size, sheet);
  for (const b of boxes) {
    g.drawImage(photo, b.x * dpi, b.y * dpi, b.w * dpi, b.h * dpi);
    g.strokeRect(b.x * dpi, b.y * dpi, b.w * dpi, b.h * dpi);
  }
  return { canvas: c, count: boxes.length };
}

/** A print sheet (src/tools/image/passportWeb.ts sheetPlan) at 300 dpi: white paper, the photos, thin gray cut lines. */
export function renderPlan(photo: HTMLCanvasElement, plan: { wMm: number; hMm: number; boxes: Box[] }, dpi = 300): HTMLCanvasElement {
  const k = dpi / 25.4;
  const c = document.createElement('canvas');
  c.width = Math.round(plan.wMm * k);
  c.height = Math.round(plan.hMm * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingQuality = 'high';
  g.strokeStyle = '#C7CBD1';
  g.lineWidth = Math.max(1, dpi / 150);
  for (const b of plan.boxes) {
    g.drawImage(photo, b.x * k, b.y * k, b.w * k, b.h * k);
    g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
  }
  return c;
}
