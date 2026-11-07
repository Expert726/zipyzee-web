// Copied from the app (src/tools/image/draw.ts); keep the two the same.
// Draw on photo: what's drawn (pen, highlighter and eraser strokes, text) and undo / redo. Positions and sizes are
// fractions of the photo (x, y of its width and height; sizes of its short side), so the preview and the saved photo
// match. Pure and unit-tested; drawn by src/lib/drawImage.ts.

export type DrawTool = 'pen' | 'highlighter' | 'eraser' | 'text';

export type DrawStroke = { kind: 'stroke'; tool: 'pen' | 'highlighter' | 'eraser'; color: string; s: number; p: [number, number][] };
export type DrawText = { kind: 'text'; text: string; color: string; s: number; x: number; y: number };
export type DrawItem = DrawStroke | DrawText;

export type DrawHistory = { past: DrawItem[][]; present: DrawItem[]; future: DrawItem[][] };

export const PEN_COLORS = ['#111827', '#FFFFFF', '#E5533D', '#F59E0B', '#16A34A', '#2563EB', '#7C3AED', '#EC4899'];

/** Highlighter ink is see-through and wider than the pen at the same size. */
export const HIGHLIGHT_ALPHA = 0.35;
export const HIGHLIGHT_WIDTH = 2.5;

export const emptyDrawing = (present: DrawItem[] = []): DrawHistory => ({ past: [], present, future: [] });

export const addItem = (h: DrawHistory, item: DrawItem): DrawHistory => ({ past: [...h.past, h.present], present: [...h.present, item], future: [] });

export function undoDraw(h: DrawHistory): DrawHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redoDraw(h: DrawHistory): DrawHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** Something to save: at least one stroke or text that isn't only eraser. */
export const hasDrawing = (items: DrawItem[]) => items.some((i) => i.kind === 'text' || i.tool !== 'eraser');

/** The stroke's width in px on a photo whose short side is `short`. */
export const strokeWidth = (st: DrawStroke, short: number) => st.s * short * (st.tool === 'highlighter' ? HIGHLIGHT_WIDTH : 1);

/** "M x y L x y …" in px, for a w x h photo; a tap is a dot. */
export function strokePath(st: DrawStroke, w: number, h: number): string {
  if (!st.p.length) return '';
  const pts = st.p.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(' ');
  return st.p.length === 1 ? `${pts} l0.1 0` : pts;
}
