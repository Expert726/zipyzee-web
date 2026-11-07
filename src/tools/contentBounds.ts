// Where a page's content is (the app's PdfNative.contentBounds, done on a page drawn by pdf.js): the smallest box around
// every pixel that isn't white, as [left, top, right, bottom] fractions of the page as displayed. Near-white (paper
// tone, faint scanner noise) counts as white; [] when the page is blank. Pure, tested.

/** Below this brightness (0-255, after mixing with white for transparency) a pixel is content. */
const WHITE = 235;

export function contentBounds(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): number[] {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      const a = rgba[i + 3] / 255;
      // brightness on white paper
      const lum = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
      if (lum >= WHITE) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return [];
  return [left / width, top / height, (right + 1) / width, (bottom + 1) / height];
}
