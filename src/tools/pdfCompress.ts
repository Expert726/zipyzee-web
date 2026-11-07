// Compress PDF's settings and wording (pure, unit-tested). The person picks a method (Quality reduction or
// Lossless), a quality (10-95 %) and, for Quality reduction, whether pages become pictures. compressSettings turns
// that into what PdfNative.compressPdf / compressPreview / estimateCompress take; pdfMix and the rules below say
// what the file is made of and what to tell the person.

export type CompressMethod = 'quality' | 'lossless';
export type CompressMode = 'lossless' | 'images' | 'pages';
export type CompressSettings = { mode: CompressMode; maxSide: number; quality: number; dpi: number };
export type PdfInfo = { total: number; images: number; imagesShrinkable: number; fonts: number; other: number; duplicate: number; pages: number };

export const MIN_QUALITY = 10;
export const MAX_QUALITY = 95;
export const DEFAULT_QUALITY = 60;

const clampQ = (q: number) => Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(q)));

/**
 * The slider as native settings: images keep at most 900 + quality × 15 px on their long side (1800 px at 60 %) and
 * are saved as JPEG at that quality; pages as pictures are drawn at 72-200 dpi.
 */
export function compressSettings(method: CompressMethod, quality: number, asImages: boolean): CompressSettings {
  if (method === 'lossless') return { mode: 'lossless', maxSide: 0, quality: 0, dpi: 0 };
  const q = clampQ(quality);
  if (asImages) return { mode: 'pages', maxSide: 0, quality: q, dpi: Math.round(72 + ((q - MIN_QUALITY) / (MAX_QUALITY - MIN_QUALITY)) * 128) };
  return { mode: 'images', maxSide: Math.round(900 + q * 15), quality: q, dpi: 0 };
}

export type Mix = { photos: number; fonts: number; other: number; main: 'photos' | 'fonts' | 'other' };

/** Shares of the file (0-1) that are photos, fonts and the rest, and which is biggest. */
export function pdfMix(info: PdfInfo): Mix {
  const total = Math.max(1, info.total);
  const photos = Math.min(1, info.images / total);
  const fonts = Math.min(1 - photos, info.fonts / total);
  const other = Math.max(0, 1 - photos - fonts);
  const main = photos >= fonts && photos >= other ? 'photos' : fonts >= other ? 'fonts' : 'other';
  return { photos, fonts, other, main };
}

/** Photos the phone can shrink are under a third of the file: shrinking them can't do much, pictures of pages can. */
export const suggestPages = (info: PdfInfo) => info.imagesShrinkable / Math.max(1, info.total) < 1 / 3;

/** Less than 3 % smaller isn't worth it: "already as small as it can get" with these settings. */
export const noRealGain = (before: number, after: number) => before <= 0 || after >= before * 0.97;

export const savingPercent = (before: number, after: number) => (before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0);
