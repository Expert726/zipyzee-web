// Background editor (pure, unit-tested) — design/BgRemover.dc.html: the swatches, output format and names, and
// mapping brush strokes from the screen into mask pixels (so edits don't depend on screen size or zoom).
import { fileStem } from '@/lib/format';
import { t } from '@/i18n';

export type BgKind = 'transparent' | 'white' | 'blue' | 'sand' | 'blur' | 'custom' | 'photo';

/** Board order: Transparent, White, Light blue, Sand, Blur, + (choose a photo); Custom color (added on request) before +. */
export const BG_SWATCHES: { value: BgKind; label: string; color?: string }[] = [
  { value: 'transparent', get label() { return t('Transparent'); } },
  { value: 'white', get label() { return t('White'); }, color: '#FFFFFF' },
  { value: 'blue', get label() { return t('Light blue'); }, color: '#BAE6FD' },
  { value: 'sand', get label() { return t('Sand'); }, color: '#F5E6C8' },
  { value: 'blur', get label() { return t('Blur original'); } },
  { value: 'custom', get label() { return t('Custom color'); } },
  { value: 'photo', get label() { return t('Choose a photo'); } },
];

export type Background =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'blur' }
  | { kind: 'photo'; uri: string };

/** The swatch as a background to draw (a photo swatch needs the chosen photo, Custom color its color). */
export function backgroundOf(kind: BgKind, photoUri?: string, customColor?: string): Background {
  if (kind === 'transparent') return { kind: 'transparent' };
  if (kind === 'blur') return { kind: 'blur' };
  if (kind === 'photo') return photoUri ? { kind: 'photo', uri: photoUri } : { kind: 'transparent' };
  if (kind === 'custom') return { kind: 'color', color: customColor || '#FFFFFF' };
  return { kind: 'color', color: BG_SWATCHES.find((s) => s.value === kind)!.color! };
}

/** Transparent needs PNG; any filled background is a photo again, so JPG (smaller). */
export const bgFormat = (kind: BgKind) => (kind === 'transparent' ? 'PNG' : 'JPEG') as 'PNG' | 'JPEG';

/** 'bottle.jpg' -> 'bottle-no-bg.png' / 'bottle-white-bg.jpg' (boards' names); Custom color -> 'bottle-color-bg.jpg'. */
export function bgFileName(name: string, kind: BgKind): string {
  return kind === 'transparent' ? `${fileStem(name)}-no-bg.png` : `${fileStem(name)}-${kind === 'custom' ? 'color' : kind}-bg.jpg`;
}

/** Blur radius for the "Blur original" background: the same look at any photo size. */
export const bgBlurSigma = (w: number, h: number) => Math.min(w, h) * 0.025;

// ---------- Fix edges ----------

export type BrushMode = 'erase' | 'restore';

/** One brush stroke in mask pixels. */
export type BgStroke = { mode: BrushMode; width: number; points: { x: number; y: number }[] };

/** Where the photo sits on screen (dp) and how big the mask is (px). */
export type MaskView = { x: number; y: number; w: number; h: number; maskW: number; maskH: number };

/** A screen point (dp, relative to the panel) -> mask pixels. */
export function toMask(px: number, py: number, v: MaskView) {
  return { x: ((px - v.x) / v.w) * v.maskW, y: ((py - v.y) / v.h) * v.maskH };
}

/** Brush diameter on screen (dp) -> mask pixels. */
export const brushInMask = (dp: number, v: MaskView) => (dp * v.maskW) / v.w;
