// Annotate and sign (design/AnnotatePdf.dc.html): items, undo/redo, ink paths and hit-testing. Pure; unit-tested.
// All positions are page points: PDF points on the page as displayed (rotation + crop box), from the top-left.

export type Pt = { x: number; y: number };

export type InkItem = { id: string; type: 'ink'; page: number; kind: 'pen' | 'highlight'; points: Pt[]; color: string; width: number };
export type TextItem = { id: string; type: 'text'; page: number; x: number; y: number; w: number; text: string; size: number };
/** Sticky note: the 28 pt icon at (x, y), the bubble with `text` under it. */
export type NoteItem = { id: string; type: 'note'; page: number; x: number; y: number; text: string };
/** `png` = base64 PNG (transparent background). `caption` = "Name, 16 Oct 2026" under it. */
/** rotation: quarter turns clockwise (0 / 90 / 180 / 270); x / y / w / h are the box as seen (already turned). */
export type SignatureItem = { id: string; type: 'signature'; page: number; x: number; y: number; w: number; h: number; png: string; caption?: string; rotation?: number };

export type Item = InkItem | TextItem | NoteItem | SignatureItem;

/** Board colors: pen #2563EB; highlighter yellow at 40% with multiply. */
export const PEN = { color: '#2563EB', width: 2 } as const;
export const HIGHLIGHT = { color: '#FDE047', width: 14, opacity: 0.4 } as const;
export const NOTE_ICON = 28;
export const NOTE_BUBBLE = { gap: 6, maxWidth: 190, padX: 10, padY: 8, size: 12, lineHeight: 17 } as const;
export const TEXT_SIZE = 14;
export const CAPTION_SIZE = 8;

let seq = 0;
export const newId = () => `a${Date.now().toString(36)}${(++seq).toString(36)}`;

/**
 * The same signature on other pages (Sign: "Add to next page" / "Add to all pages"): the same spot and size on each
 * target page, pulled back inside a smaller page; never on its own page again.
 */
export function copyToPages(item: SignatureItem, targets: number[], sizes: { width: number; height: number }[]): SignatureItem[] {
  return targets
    .filter((p) => p !== item.page && sizes[p])
    .map((p) => {
      const { width, height } = sizes[p];
      const w = Math.min(item.w, width);
      const h = (w * item.h) / item.w;
      return { ...item, id: newId(), page: p, w, h, x: Math.max(0, Math.min(width - w, item.x)), y: Math.max(0, Math.min(height - h, item.y)) };
    });
}

// ---------- history ----------

export type History = { past: Item[][]; present: Item[]; future: Item[][] };

export const emptyHistory = (): History => ({ past: [], present: [], future: [] });

/** New state; one undo step. */
export function commit(h: History, next: Item[]): History {
  return { past: [...h.past, h.present], present: next, future: [] };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

// ---------- ink ----------

const r = (n: number) => Math.round(n * 100) / 100;

/** Smooth SVG path through the points (quadratic curves through midpoints). Same path in Skia and pdf-lib. */
export function toSvgPath(points: Pt[]): string {
  if (!points.length) return '';
  const [p0] = points;
  if (points.length === 1) return `M${r(p0.x)} ${r(p0.y)} L${r(p0.x + 0.01)} ${r(p0.y)}`;
  if (points.length === 2) return `M${r(p0.x)} ${r(p0.y)} L${r(points[1].x)} ${r(points[1].y)}`;
  let d = `M${r(p0.x)} ${r(p0.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    d += ` Q${r(a.x)} ${r(a.y)} ${r((a.x + b.x) / 2)} ${r((a.y + b.y) / 2)}`;
  }
  const last = points[points.length - 1];
  return `${d} L${r(last.x)} ${r(last.y)}`;
}

/** Drops points closer than `min` to the previous one (fewer points, smoother curves). */
export function addPoint(points: Pt[], p: Pt, min = 0.75): Pt[] {
  const last = points[points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < min) return points;
  return [...points, p];
}

// ---------- hit-testing ----------

function distToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Box an item covers on its page, for taps and the eraser. Notes: the icon (the bubble is sized by the UI). */
export function itemBox(item: Exclude<Item, InkItem>): { x: number; y: number; w: number; h: number } {
  switch (item.type) {
    case 'text':
      return { x: item.x, y: item.y, w: item.w, h: item.size * 1.4 * Math.max(1, item.text.split('\n').length) };
    case 'note':
      return { x: item.x, y: item.y, w: NOTE_ICON, h: NOTE_ICON };
    case 'signature':
      return { x: item.x, y: item.y, w: item.w, h: item.h };
  }
}

export function hitsItem(item: Item, p: Pt, radius: number): boolean {
  if (item.type === 'ink') {
    const reach = radius + item.width / 2;
    if (item.points.length === 1) return Math.hypot(p.x - item.points[0].x, p.y - item.points[0].y) <= reach;
    for (let i = 1; i < item.points.length; i++) {
      if (distToSegment(p, item.points[i - 1], item.points[i]) <= reach) return true;
    }
    return false;
  }
  const b = itemBox(item);
  return p.x >= b.x - radius && p.x <= b.x + b.w + radius && p.y >= b.y - radius && p.y <= b.y + b.h + radius;
}

/** Topmost item under a point on a page (later items are drawn on top). */
export function itemAt(items: Item[], page: number, p: Pt, radius: number): Item | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].page === page && hitsItem(items[i], p, radius)) return items[i];
  }
  return undefined;
}

/** Eraser: everything on the page within `radius` of the point. */
export function erase(items: Item[], page: number, p: Pt, radius: number): Item[] {
  return items.filter((it) => it.page !== page || !hitsItem(it, p, radius));
}

// ---------- text layout (shared by the editor's Skia text and the pdf-lib flatten) ----------

/** Greedy word wrap; keeps the user's line breaks. `measure` = text width at the font size in use. */
export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

/** Note bubble under the icon (board: max 190 wide, padding 8/10, 12/17 text). */
export function noteBubbleLayout(text: string, measure: (s: string) => number) {
  const { maxWidth, padX, padY, lineHeight } = NOTE_BUBBLE;
  const lines = wrapLines(text, measure, maxWidth - padX * 2);
  const w = Math.min(maxWidth, Math.max(...lines.map(measure)) + padX * 2);
  return { lines, w, h: lines.length * lineHeight + padY * 2 };
}

/** Bubble left edge: under the icon, moved left when it would run off the page (8 pt inset). */
export function bubbleLeft(noteX: number, bubbleW: number, pageWidth: number) {
  return Math.max(8, Math.min(noteX, pageWidth - bubbleW - 8));
}

// ---------- signatures ----------

/** "Zain Ahmed" -> "ZA" (the initials tile). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** "Zain Ahmed, 16 Oct 2026" (date only without a name). */
export function signatureCaption(name: string, d = new Date()): string {
  const date = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })} ${d.getFullYear()}`;
  return name.trim() ? `${name.trim()}, ${date}` : date;
}

/** A quarter turn clockwise about the box's centre (added on request): the box swaps width and height. */
export function rotateSignature(item: SignatureItem): SignatureItem {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  return { ...item, rotation: ((item.rotation ?? 0) + 90) % 360, w: item.h, h: item.w, x: cx - item.h / 2, y: cy - item.w / 2 };
}

/** The signature picture's own size (before turning): the box with width and height swapped when it's sideways. */
export const signatureImageSize = (item: SignatureItem) => ((item.rotation ?? 0) % 180 ? { w: item.h, h: item.w } : { w: item.w, h: item.h });

/** Resize keeping the aspect ratio from a dragged corner; never smaller than `min` points wide. */
export function resizeFromCorner(
  box: { x: number; y: number; w: number; h: number },
  corner: 'tl' | 'tr' | 'bl' | 'br',
  dx: number,
  min = 24,
): { x: number; y: number; w: number; h: number } {
  const ratio = box.h / box.w;
  const grow = corner === 'tr' || corner === 'br' ? dx : -dx;
  const w = Math.max(min, box.w + grow);
  const h = w * ratio;
  const x = corner === 'tl' || corner === 'bl' ? box.x + box.w - w : box.x;
  const y = corner === 'tl' || corner === 'tr' ? box.y + box.h - h : box.y;
  return { x, y, w, h };
}
