// Redact PDF on the phone: which words to black out. The words and their boxes come from PdfNative.pageWords
// (0-1 of the page as shown, top-left origin). A typed term matches whole words in order, ignoring case ("account
// number" covers both words); Phone numbers and Emails are found by pattern. Pure and unit-tested; handlers/redactPdf.ts
// draws the boxes and flattens those pages.
import type { PageWords } from './compare';

export type RedactPattern = 'phones' | 'emails';
export type Box = { x: number; y: number; w: number; h: number };

// +92 300 1234567, 0300-1234567, (021) 3456 7890, 35202-1234567-1 (CNIC): 10 or more digits with spaces, dashes, dots
const PHONE = /\+?\(?\d[\d\s().-]{8,}\d/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const DIGITS = 10;

/** "CNIC, account number" -> ["cnic", "account number"] */
export const parseTerms = (text: string) =>
  text.split(/[,\n]/).map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);

/** A little bigger than the word, so no edge of a letter shows. */
const pad = (b: Box, by = 0.002): Box => ({ x: Math.max(0, b.x - by), y: Math.max(0, b.y - by), w: b.w + by * 2, h: b.h + by * 2 });

/** The page's words joined by spaces, and where each word starts and ends in that text. */
function joined(words: PageWords['words']) {
  const spans: [number, number][] = [];
  let text = '';
  for (const [w] of words) {
    if (text) text += ' ';
    spans.push([text.length, text.length + w.length]);
    text += w;
  }
  return { text, spans };
}

/** Indexes of the words a [start, end) stretch of the joined text touches. */
const wordsIn = (spans: [number, number][], start: number, end: number) =>
  spans.flatMap(([a, b], i) => (a < end && b > start ? [i] : []));

/** Boxes to black out on each page, and how many things were found. */
export function findRedactions(pages: PageWords[], terms: string[], patterns: RedactPattern[]): { boxes: Box[][]; count: number } {
  let count = 0;
  const boxes = pages.map((page) => {
    const { text, spans } = joined(page.words);
    const lower = text.toLowerCase();
    const hit = new Set<number>();
    const mark = (start: number, end: number) => {
      const ws = wordsIn(spans, start, end);
      if (!ws.length) return;
      count++;
      ws.forEach((i) => hit.add(i));
    };
    for (const term of terms) {
      if (!term) continue;
      // whole words only: "cnic" doesn't hide "cnicx"
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\p{L}\\p{N}])`, 'gu');
      for (const m of lower.matchAll(re)) {
        const start = (m.index ?? 0) + m[1].length;
        mark(start, start + m[2].length);
      }
    }
    if (patterns.includes('phones')) {
      for (const m of text.matchAll(PHONE)) {
        if ((m[0].match(/\d/g)?.length ?? 0) >= DIGITS) mark(m.index ?? 0, (m.index ?? 0) + m[0].length);
      }
    }
    if (patterns.includes('emails')) {
      for (const m of text.matchAll(EMAIL)) mark(m.index ?? 0, (m.index ?? 0) + m[0].length);
    }
    return [...hit].sort((a, b) => a - b).map((i) => {
      const [, x, y, w, h] = page.words[i];
      return pad({ x, y, w, h });
    });
  });
  return { boxes, count };
}

// ---------- marking by hand (custom/redact/RedactStep: drag a box, tap a word, tap a box to remove it) ----------

export type Pt = { x: number; y: number };

/** A drag shorter than this (in page fractions) is a tap, not a box. */
const MIN_DRAG = 0.01;
/** Room around a word or box for a finger (page fractions). */
const TOUCH = 0.006;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The box a drag from `a` to `b` makes, in any direction and kept on the page; null for a tap-sized drag. */
export function boxFromDrag(a: Pt, b: Pt): Box | null {
  const x0 = clamp01(Math.min(a.x, b.x));
  const y0 = clamp01(Math.min(a.y, b.y));
  const x1 = clamp01(Math.max(a.x, b.x));
  const y1 = clamp01(Math.max(a.y, b.y));
  if (x1 - x0 < MIN_DRAG && y1 - y0 < MIN_DRAG) return null;
  // a thin swipe along a line of text still covers the line
  return { x: x0, y: y0, w: Math.max(x1 - x0, MIN_DRAG), h: Math.max(y1 - y0, MIN_DRAG) };
}

const hits = (b: Box, p: Pt, slack = TOUCH) => p.x >= b.x - slack && p.x <= b.x + b.w + slack && p.y >= b.y - slack && p.y <= b.y + b.h + slack;

/** The box under a tap (the last drawn wins), or -1. */
export function boxAt(boxes: Box[], p: Pt): number {
  for (let i = boxes.length - 1; i >= 0; i--) if (hits(boxes[i], p)) return i;
  return -1;
}

/** The box of the word under a tap (a little bigger, like Find's), or null. */
export function wordAt(page: PageWords | undefined, p: Pt): Box | null {
  const w = page?.words.find(([, x, y, ww, h]) => hits({ x, y, w: ww, h }, p));
  return w ? pad({ x: w[1], y: w[2], w: w[3], h: w[4] }) : null;
}

const same = (a: Box, b: Box) => Math.abs(a.x - b.x) < 1e-4 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.w - b.w) < 1e-4 && Math.abs(a.h - b.h) < 1e-4;

/** Boxes added to a page's boxes, without the ones already there. */
export const addBoxes = (page: Box[], more: Box[]) => [...page, ...more.filter((b) => !page.some((x) => same(x, b)))];

/** Every page's boxes with Find's boxes added (pages beyond the list start empty). */
export const mergePages = (pages: Box[][], found: Box[][]) =>
  Array.from({ length: Math.max(pages.length, found.length) }, (_, i) => addBoxes(pages[i] ?? [], found[i] ?? []));

export const countBoxes = (pages: Box[][]) => pages.reduce((n, p) => n + p.length, 0);
