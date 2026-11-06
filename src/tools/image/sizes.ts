// Resize and compress math for the image tools (pure, unit-tested): design/FlowResizeImage.dc.html,
// FlowCompressImage.dc.html, FlowBatchEdit.dc.html.
import { fileStem } from '@/lib/format';
import { t } from '@/i18n';

export type Size = { w: number; h: number };

export type ResizeBy = 'pixels' | 'percent' | 'preset';

export const RESIZE_PRESETS = [
  { value: 'instagram', get label() { return t('Instagram post'); }, w: 1080, h: 1350 },
  { value: 'whatsapp', get label() { return t('WhatsApp DP'); }, w: 500, h: 500 },
  { value: 'facebook', get label() { return t('Facebook cover'); }, w: 820, h: 312 },
  { value: 'a4', get label() { return t('A4 print'); }, w: 2480, h: 3508 },
] as const;

/** contain: fit inside the box; cover: fill it exactly, cutting the overflow from the centre; stretch: exact. */
export type ResizeMode = 'contain' | 'cover' | 'stretch';

export type ResizeOptions = { by: ResizeBy; width: number; height: number; keep: boolean; percent: number; preset: string };

/** The output size for one photo and how to get there. */
export function resizeTarget(src: Size, o: ResizeOptions): Size & { mode: ResizeMode } {
  if (o.by === 'percent') {
    const k = Math.max(1, o.percent) / 100;
    return { w: Math.max(1, Math.round(src.w * k)), h: Math.max(1, Math.round(src.h * k)), mode: 'stretch' };
  }
  if (o.by === 'preset') {
    const p = RESIZE_PRESETS.find((x) => x.value === o.preset) ?? RESIZE_PRESETS[0];
    return { w: p.w, h: p.h, mode: 'cover' };
  }
  const w = Math.max(1, Math.round(o.width || src.w));
  const h = Math.max(1, Math.round(o.height || src.h));
  if (!o.keep) return { w, h, mode: 'stretch' };
  const k = Math.min(w / src.w, h / src.h);
  return { w: Math.max(1, Math.round(src.w * k)), h: Math.max(1, Math.round(src.h * k)), mode: 'contain' };
}

/** With Keep proportions on, typing one side fills in the other from the first photo's shape. */
export function linkedSide(changed: 'width' | 'height', value: number, src: Size): number {
  return Math.max(1, Math.round(changed === 'width' ? (value * src.h) / src.w : (value * src.w) / src.h));
}

/** Long side capped at `longest` (Batch edit "Longest side"); never scales up. */
export function capLongest(src: Size, longest: number): Size {
  const k = Math.min(1, longest / Math.max(src.w, src.h));
  return { w: Math.max(1, Math.round(src.w * k)), h: Math.max(1, Math.round(src.h * k)) };
}

/** "4032 × 3024" */
export const sizeLabel = (s: Size) => `${s.w} × ${s.h}`;

// ---------- formats and names ----------

export type ImageFormat = 'JPEG' | 'PNG' | 'WEBP';

export const EXT: Record<ImageFormat, string> = { JPEG: 'jpg', PNG: 'png', WEBP: 'webp' };
export const MIME: Record<ImageFormat, string> = { JPEG: 'image/jpeg', PNG: 'image/png', WEBP: 'image/webp' };

/** The format a photo is in now, from its MIME type or name. HEIC and others are saved as JPG. */
export function formatOf(name: string, mime?: string): ImageFormat {
  const m = (mime ?? '').toLowerCase();
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  if (m === 'image/png' || ext === 'png') return 'PNG';
  if (m === 'image/webp' || ext === 'webp') return 'WEBP';
  return 'JPEG';
}

/** JPG, PNG or WebP: formats we can copy or edit in place. Others (HEIC) are always re-encoded to JPG. */
export function isWebImage(name: string, mime?: string): boolean {
  return /^image\/(jpe?g|png|webp)$/i.test(mime ?? '') || /\.(jpe?g|png|webp)$/i.test(name);
}

/** 'IMG_2041.HEIC', '-small', 'JPEG' -> 'IMG_2041-small.jpg' */
export const outName = (name: string, suffix: string, format: ImageFormat) => `${fileStem(name)}${suffix}.${EXT[format]}`;

// ---------- compress estimate ----------

/** Total after compressing, from a few compressed samples: the same saving applied to all photos. */
export function estimateTotal(samples: { before: number; after: number }[], totalBefore: number) {
  const before = samples.reduce((s, x) => s + x.before, 0);
  const after = samples.reduce((s, x) => s + Math.min(x.after, x.before), 0); // never bigger: we keep the original
  const total = before > 0 ? Math.round((totalBefore * after) / before) : totalBefore;
  return { total, saving: savingPercent(totalBefore, total) };
}

/** 9.6 MB -> 1.9 MB = 80 (percent smaller), never negative. */
export const savingPercent = (before: number, after: number) => (before > 0 ? Math.max(0, Math.round((1 - after / before) * 100)) : 0);

// ---------- Compress image: "Under 100 KB" (job and admission portals) ----------

/** Target sizes offered, in KB. */
export const TARGET_KB = [50, 100, 200, 500] as const;
/** Sizes tried, largest first, when the lowest quality alone isn't small enough. */
export const TARGET_SCALES = [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25];
const MIN_Q = 30;
const MAX_Q = 90;

export type Fit = { scale: number; quality: number; size: number; fits: boolean };

/**
 * The biggest photo at the best quality that's at most `target` bytes. `encode(scale, quality)` makes one try and
 * gives its size. Each size: the lowest quality first (does it fit at all?), then a search for the best quality that
 * still fits. If nothing fits, the smallest try. Pure; the handler re-encodes for real.
 */
export async function fitUnder(target: number, encode: (scale: number, quality: number) => Promise<number>): Promise<Fit> {
  let smallest: Fit | null = null;
  for (const scale of TARGET_SCALES) {
    const low = await encode(scale, MIN_Q);
    if (low > target) {
      if (!smallest || low < smallest.size) smallest = { scale, quality: MIN_Q, size: low, fits: false };
      continue;
    }
    let lo = MIN_Q;
    let hi = MAX_Q + 5;
    let best = { quality: MIN_Q, size: low };
    while (hi - lo > 5) {
      const q = Math.round((lo + hi) / 10) * 5;
      if (q <= lo || q >= hi) break;
      const size = await encode(scale, q);
      if (size <= target) {
        lo = q;
        best = { quality: q, size };
      } else {
        hi = q;
      }
    }
    return { scale, quality: best.quality, size: best.size, fits: true };
  }
  return smallest!;
}
