// Collage maker on the web: each photo's own framing in its cell (pure). The app always cuts photos from the centre
// (./collage.ts coverSource); here the person can zoom in and move the photo inside its cell. The same source rect
// draws the preview and the saved collage.
import { collageLayout, COLLAGE_LAYOUTS, coverSource, type CollageLayout, type Rect } from './collage';

/** zoom: 1 = the photo just fills the cell; fx / fy: where the visible part sits, 0 = left / top, 1 = right / bottom. */
export type CellFit = { zoom: number; fx: number; fy: number };
export const CENTERED: CellFit = { zoom: 1, fx: 0.5, fy: 0.5 };
export const MAX_ZOOM = 4;

/** The part of an iw x ih photo shown in a cw x ch cell. */
export function fitSource(iw: number, ih: number, cw: number, ch: number, f: CellFit = CENTERED): Rect {
  const base = coverSource(iw, ih, cw, ch);
  const z = Math.min(MAX_ZOOM, Math.max(1, f.zoom));
  const w = base.w / z;
  const h = base.h / z;
  return { x: (iw - w) * clamp01(f.fx), y: (ih - h) * clamp01(f.fy), w, h };
}

/** Moved by (dx, dy) cell pixels on a cell `cellW` pixels wide (drag right = the photo moves right). */
export function panned(iw: number, ih: number, cw: number, ch: number, f: CellFit, dx: number, dy: number, cellW: number): CellFit {
  const s = fitSource(iw, ih, cw, ch, f);
  const perPx = s.w / cellW;
  const x = Math.min(iw - s.w, Math.max(0, s.x - dx * perPx));
  const y = Math.min(ih - s.h, Math.max(0, s.y - dy * perPx));
  return { ...f, fx: iw - s.w > 0.5 ? x / (iw - s.w) : 0.5, fy: ih - s.h > 0.5 ? y / (ih - s.h) : 0.5 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

// ---------- layouts (web) ----------


/** The app's five and their mirrors; the big photo takes 60% (the app's bigLeft is 50%, the same as two columns). */
export type WebLayout = CollageLayout | 'bigRight' | 'bigBottom';
export const WEB_LAYOUTS: WebLayout[] = [...COLLAGE_LAYOUTS, 'bigRight', 'bigBottom'];
const BIG = 0.6;

/** Where each of n photos goes on a w x h collage (the preview, the layout tiles and the saved image). */
export function layoutRects(n: number, layout: WebLayout, w: number, h: number, gap: number): Rect[] {
  if (n < 2 || (layout !== 'bigLeft' && layout !== 'bigRight' && layout !== 'bigBottom')) return collageLayout(n, layout === 'bigRight' || layout === 'bigBottom' ? 'grid' : layout, w, h, gap);
  const inner = { x: gap, y: gap, w: w - gap * 2, h: h - gap * 2 };
  if (layout === 'bigBottom') {
    // the app's bigTop turned upside down
    return collageLayout(n, 'bigTop', w, h, gap).map((r) => ({ ...r, y: h - r.y - r.h }));
  }
  const big = (inner.w - gap) * BIG;
  const restW = inner.w - gap - big;
  // the rest stacked in the other part (the app's rows inside it)
  const rest = collageLayout(n - 1, 'rows', restW + gap * 2, inner.h + gap * 2, gap).map((r) => ({ ...r, x: r.x - gap + inner.x + big + gap, y: r.y - gap + inner.y }));
  const out = [{ x: inner.x, y: inner.y, w: big, h: inner.h }, ...rest];
  return layout === 'bigRight' ? out.map((r) => ({ ...r, x: w - r.x - r.w })) : out;
}

/** The layouts that look different for n photos (two that give the same cells: only the first is offered). */
export function distinctLayouts(n: number): WebLayout[] {
  const seen = new Set<string>();
  return WEB_LAYOUTS.filter((l) => {
    const key = layoutRects(Math.max(2, n), l, 100, 100, 2).map((r) => [r.x, r.y, r.w, r.h].map((v) => Math.round(v)).join(',')).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
