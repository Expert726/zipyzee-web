import { t } from '@/i18n';
// Copied from the app (src/tools/image/collage.ts); keep the two the same.
// Collage layouts (pure, unit-tested) — design/FlowCollage.dc.html: 5 layout tiles, Spacing, Shape.
// The same rects draw the preview, the layout tiles and the saved image, so they always match.

export type CollageLayout = 'grid' | 'rows' | 'columns' | 'bigLeft' | 'bigTop';
export const COLLAGE_LAYOUTS: CollageLayout[] = ['grid', 'rows', 'columns', 'bigLeft', 'bigTop'];

export type CollageShape = 'square' | 'story' | 'portrait';
export const COLLAGE_SHAPES = [
  { get label() { return t('Square'); }, value: 'square' },
  { get label() { return t('Story 9:16'); }, value: 'story' },
  { label: '4:5', value: 'portrait' },
] as const;

/** Output size: 2048 px on the long side. */
export const COLLAGE_SIZE: Record<CollageShape, { w: number; h: number }> = {
  square: { w: 2048, h: 2048 },
  story: { w: 1152, h: 2048 },
  portrait: { w: 1638, h: 2048 },
};

/** The board's preview width: Spacing (px) and the cell corner radius are measured on it, then scaled. */
export const COLLAGE_PREVIEW = 350;
export const COLLAGE_CELL_RADIUS = 6;

export type Rect = { x: number; y: number; w: number; h: number };

/** Splits a rect into `n` equal parts side by side (horizontal) or stacked, with `gap` between them. */
function split(r: Rect, n: number, horizontal: boolean, gap: number): Rect[] {
  const total = (horizontal ? r.w : r.h) - gap * (n - 1);
  const part = total / n;
  return Array.from({ length: n }, (_, i) =>
    horizontal ? { x: r.x + i * (part + gap), y: r.y, w: part, h: r.h } : { x: r.x, y: r.y + i * (part + gap), w: r.w, h: part },
  );
}

/** Lines of cells: `counts[i]` photos in line i. Lines are rows (stacked) or columns (side by side). */
function lines(r: Rect, counts: number[], asRows: boolean, gap: number): Rect[] {
  const strips = split(r, counts.length, !asRows, gap);
  return strips.flatMap((s, i) => split(s, counts[i], asRows, gap));
}

/** n photos as evenly as possible over k lines, larger lines first: 5 over 2 -> [3, 2]. */
function spread(n: number, k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

/**
 * Where each of n photos (2-9) goes on a w x h canvas. `gap` is the spacing between photos and around the edge.
 * grid: near-square grid · rows: stacked strips (2 per strip past 4) · columns: side by side (2 per column past 4)
 * bigLeft: first photo fills the left half, the rest stack on the right · bigTop: first on top, the rest in a row below.
 */
export function collageLayout(n: number, layout: CollageLayout, w: number, h: number, gap: number): Rect[] {
  const count = Math.max(1, Math.min(9, n));
  const inner: Rect = { x: gap, y: gap, w: w - gap * 2, h: h - gap * 2 };
  if (count === 1) return [inner];
  switch (layout) {
    case 'grid': {
      const cols = Math.ceil(Math.sqrt(count));
      return lines(inner, spread(count, Math.ceil(count / cols)), true, gap);
    }
    case 'rows':
      return count <= 4 ? split(inner, count, false, gap) : lines(inner, spread(count, Math.ceil(count / 2)), true, gap);
    case 'columns':
      return count <= 4 ? split(inner, count, true, gap) : lines(inner, spread(count, Math.ceil(count / 2)), false, gap);
    case 'bigLeft': {
      const [left, right] = split(inner, 2, true, gap);
      return [left, ...lines(right, spread(count - 1, Math.min(count - 1, 4)), true, gap)];
    }
    case 'bigTop': {
      const topH = (inner.h - gap) * 0.6;
      const top: Rect = { x: inner.x, y: inner.y, w: inner.w, h: topH };
      const rest: Rect = { x: inner.x, y: inner.y + topH + gap, w: inner.w, h: inner.h - topH - gap };
      return [top, ...lines(rest, spread(count - 1, count - 1 > 4 ? 2 : 1), true, gap)];
    }
  }
}

/** Source rect of an image of size iw x ih that fills a cell of aspect cw:ch (cut from the centre). */
export function coverSource(iw: number, ih: number, cw: number, ch: number): Rect {
  const k = Math.max(cw / iw, ch / ih);
  const sw = cw / k;
  const sh = ch / k;
  return { x: (iw - sw) / 2, y: (ih - sh) / 2, w: sw, h: sh };
}
