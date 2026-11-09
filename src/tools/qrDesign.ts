/* eslint-disable no-bitwise -- base64 and colour maths work on bits */
// Copied from the app (src/tools/qrDesign.ts); keep the two the same.
// QR code design (added on request): which colours can be used together. A QR code only scans when its dots are much
// darker than the background, so a colour pair needs a WCAG contrast of at least 3 (every colour of a gradient).
// Pure and unit-tested; the swatches are qrInks / qrBackgrounds in tokens.ts.

/** Relative luminance of #RRGGBB (WCAG 2). */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_QR_CONTRAST = 3;

/** Dark dots on a light background, far enough apart to scan (inverted codes are refused: many scanners can't). */
export function scannable(inks: string[], background: string): boolean {
  return inks.every((ink) => luminance(ink) < luminance(background) && contrast(ink, background) >= MIN_QR_CONTRAST);
}
