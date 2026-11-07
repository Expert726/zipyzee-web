import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { contentBounds } from '@/tools/contentBounds';
import { cropToBounds } from '@/tools/pdfOps';

/** A w x h white picture with a dark box from (x0, y0) to (x1, y1), exclusive. */
function picture(w: number, h: number, box?: [number, number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  if (box) {
    for (let y = box[1]; y < box[3]; y++)
      for (let x = box[0]; x < box[2]; x++) {
        const i = (y * w + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = 20;
      }
  }
  return px;
}

describe('Crop PDF', () => {
  it('finds the content box as fractions of the page', () => {
    expect(contentBounds(picture(100, 200, [10, 20, 90, 180]), 100, 200)).toEqual([0.1, 0.1, 0.9, 0.9]);
  });

  it('ignores near-white noise and says blank pages are blank', () => {
    const px = picture(10, 10);
    px[0] = px[1] = px[2] = 245; // faint scanner dust
    expect(contentBounds(px, 10, 10)).toEqual([]);
  });

  it('sets the crop box with the margin kept', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    expect(cropToBounds(page, [0.1, 0.1, 0.9, 0.9])).toBe(true);
    const box = page.getCropBox();
    expect(box.x).toBeCloseTo(60 - 18);
    expect(box.width).toBeCloseTo(480 + 36);
    expect(cropToBounds(page, [0, 0, 1, 1])).toBe(false); // already the content
  });
});
