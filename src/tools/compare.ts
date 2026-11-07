// Compare PDF (design/FlowComparePdf.dc.html): word-by-word differences between two versions, page by page.
// Pure and unit-tested; the words and their boxes come from PdfNative.pageWords (PdfBox on the phone).

/** [text, x, y, width, height] with the box in 0-1 of the page as shown. */
export type Word = [string, number, number, number, number];
export type PageWords = { w: number; h: number; words: Word[] };

export type Box = { x: number; y: number; w: number; h: number };
/** One page pair: boxes of removed words (on version 1) and added words (on version 2). */
export type PageDiff = { removed: Box[]; added: Box[]; changes: number };
export type CompareOutput = {
  pages: PageDiff[];
  total: number;
  /** Pages in each version (a page only in one version is all added or all removed). */
  pages1: number;
  pages2: number;
};

type Op = { kind: 'same' | 'add' | 'del'; a?: number; b?: number };

/** Myers' O(ND) diff of two word lists (compared as written, so a changed comma counts). */
export function diff(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(new Map(v));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && (v.get(k - 1) ?? -1) < (v.get(k + 1) ?? -1)) ? v.get(k + 1) ?? 0 : (v.get(k - 1) ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v.set(k, x);
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  // walk back through the trace
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0 && (x > 0 || y > 0); d--) {
    const vd = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && (vd.get(k - 1) ?? -1) < (vd.get(k + 1) ?? -1)) ? k + 1 : k - 1;
    const prevX = vd.get(prevK) ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ kind: 'same', a: --x, b: --y });
    }
    if (d > 0) {
      if (x === prevX) ops.push({ kind: 'add', b: --y });
      else ops.push({ kind: 'del', a: --x });
    }
  }
  return ops.reverse();
}

/** Number of changed runs: a run of removals and additions next to each other counts as one change. */
export function countChanges(ops: Op[]): number {
  let n = 0;
  let inRun = false;
  for (const op of ops) {
    if (op.kind === 'same') inRun = false;
    else if (!inRun) {
      n++;
      inRun = true;
    }
  }
  return n;
}

const box = (w: Word): Box => ({ x: w[1], y: w[2], w: w[3], h: w[4] });

/** Pairs page i with page i; words compared without surrounding punctuation case differences kept. */
export function comparePages(v1: PageWords[], v2: PageWords[]): CompareOutput {
  const count = Math.max(v1.length, v2.length);
  const pages: PageDiff[] = [];
  for (let i = 0; i < count; i++) {
    const a = v1[i]?.words ?? [];
    const b = v2[i]?.words ?? [];
    const ops = diff(a.map((w) => w[0]), b.map((w) => w[0]));
    pages.push({
      removed: ops.filter((o) => o.kind === 'del').map((o) => box(a[o.a!])),
      added: ops.filter((o) => o.kind === 'add').map((o) => box(b[o.b!])),
      changes: countChanges(ops),
    });
  }
  return { pages, total: pages.reduce((s, p) => s + p.changes, 0), pages1: v1.length, pages2: v2.length };
}
