import { describe, expect, it } from 'vitest';
import {
  addPoint,
  commit,
  emptyHistory,
  erase,
  initials,
  itemAt,
  redo,
  resizeFromCorner,
  rotateSignature,
  signatureImageSize,
  signatureCaption,
  toSvgPath,
  undo,
  type InkItem,
  type Item,
} from '@/tools/annotate/model';
import { clampPan, contentToScreen, layoutPages, screenToPage, zoomAbout } from '@/tools/annotate/geometry';

const ink = (id: string, page: number, points: [number, number][]): InkItem => ({
  id, type: 'ink', page, kind: 'pen', color: '#2563EB', width: 2, points: points.map(([x, y]) => ({ x, y })),
});

describe('toSvgPath', () => {
  it('handles 1, 2 and many points', () => {
    expect(toSvgPath([])).toBe('');
    expect(toSvgPath([{ x: 1, y: 2 }])).toBe('M1 2 L1.01 2');
    expect(toSvgPath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1 2 L3 4');
    expect(toSvgPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBe('M0 0 Q10 0 10 5 Q10 10 5 10 L0 10');
  });

  it('skips points closer than the minimum distance', () => {
    let pts = addPoint([], { x: 0, y: 0 });
    pts = addPoint(pts, { x: 0.2, y: 0.2 });
    pts = addPoint(pts, { x: 2, y: 0 });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 2, y: 0 }]);
  });
});

describe('history', () => {
  it('undoes and redoes, and a new change clears redo', () => {
    let h = emptyHistory();
    h = commit(h, [ink('a', 0, [[0, 0]])]);
    h = commit(h, [...h.present, ink('b', 0, [[5, 5]])]);
    expect(h.present.map((i) => i.id)).toEqual(['a', 'b']);
    h = undo(h);
    expect(h.present.map((i) => i.id)).toEqual(['a']);
    h = redo(h);
    expect(h.present.map((i) => i.id)).toEqual(['a', 'b']);
    h = undo(undo(h));
    expect(h.present).toEqual([]);
    expect(undo(h)).toBe(h); // nothing left to undo
    h = commit(h, [ink('c', 0, [[1, 1]])]);
    expect(h.future).toEqual([]);
  });
});

describe('hit-testing and eraser', () => {
  const items: Item[] = [
    ink('line', 0, [[0, 0], [100, 0]]),
    ink('other-page', 1, [[0, 0], [100, 0]]),
    { id: 'sig', type: 'signature', page: 0, x: 50, y: 50, w: 100, h: 40, png: '' },
  ];

  it('hits a stroke near its segment and items by their box', () => {
    expect(itemAt(items, 0, { x: 50, y: 3 }, 2)?.id).toBe('line');
    expect(itemAt(items, 0, { x: 50, y: 10 }, 2)).toBeUndefined();
    expect(itemAt(items, 0, { x: 120, y: 70 }, 0)?.id).toBe('sig');
  });

  it('erases only on the touched page', () => {
    expect(erase(items, 0, { x: 50, y: 1 }, 4).map((i) => i.id)).toEqual(['other-page', 'sig']);
  });
});

describe('signatures', () => {
  it('makes initials and captions', () => {
    expect(initials('Zain Ahmed')).toBe('ZA');
    expect(initials('  zain  ')).toBe('Z');
    expect(signatureCaption('Zain Ahmed', new Date(2026, 9, 16))).toBe('Zain Ahmed, 16 Oct 2026');
    expect(signatureCaption('', new Date(2026, 9, 16))).toBe('16 Oct 2026');
  });

  it('resizes from a corner keeping the aspect ratio and the opposite corner', () => {
    const box = { x: 100, y: 100, w: 200, h: 100 };
    expect(resizeFromCorner(box, 'br', 50)).toEqual({ x: 100, y: 100, w: 250, h: 125 });
    expect(resizeFromCorner(box, 'tl', -50)).toEqual({ x: 50, y: 75, w: 250, h: 125 });
    expect(resizeFromCorner(box, 'br', -500).w).toBe(24);
  });
});

describe('geometry', () => {
  // 390 dp wide screen; an A4 page and a landscape page
  const { pages, contentHeight } = layoutPages([{ width: 595, height: 842 }, { width: 842, height: 595 }], 390);

  it('stacks pages at the screen width minus margins', () => {
    expect(pages[0]).toMatchObject({ left: 16, top: 16, width: 358 });
    expect(pages[1].top).toBeCloseTo(16 + pages[0].height + 16);
    expect(contentHeight).toBeCloseTo(pages[1].top + pages[1].height + 16);
  });

  it.each([
    [1, { x: 0, y: 0 }],
    [2.5, { x: -300, y: -900 }],
    [4, { x: -1000, y: -2500 }],
  ])('maps a touch to the same page point at zoom %f', (zoom, pan) => {
    const target = { x: 300, y: 400 }; // page points on page 1
    const c = { x: pages[0].left + target.x * pages[0].pxPerPt, y: pages[0].top + target.y * pages[0].pxPerPt };
    const hit = screenToPage(contentToScreen(c, zoom, pan), pages, zoom, pan);
    expect(hit?.page.index).toBe(0);
    expect(hit?.point.x).toBeCloseTo(300);
    expect(hit?.point.y).toBeCloseTo(400);
  });

  it('finds no page in the gap between pages', () => {
    expect(screenToPage({ x: 200, y: pages[0].top + pages[0].height + 8 }, pages, 1, { x: 0, y: 0 })).toBeUndefined();
  });

  it('zooms about the fingers and keeps the content on screen', () => {
    const focal = { x: 200, y: 300 };
    const z = zoomAbout(focal, 1, { x: 0, y: 0 }, 3);
    // the content point under the fingers stays under them
    expect(z.pan).toEqual({ x: 200 - 200 * 3, y: 300 - 300 * 3 });
    expect(zoomAbout(focal, 1, { x: 0, y: 0 }, 10).zoom).toBe(4);
    expect(clampPan({ x: 50, y: 50 }, 2, { width: 390, height: 700 }, 2000)).toEqual({ x: 0, y: 0 });
    expect(clampPan({ x: -9999, y: -9999 }, 2, { width: 390, height: 700 }, 2000)).toEqual({ x: -390, y: 700 - 4000 });
  });
});

describe('turning a signature (added on request)', () => {
  it('a quarter turn clockwise about its centre: the box swaps width and height, four turns come back', () => {
    const sig = { id: 's', type: 'signature' as const, page: 0, x: 100, y: 200, w: 180, h: 60, png: '' };
    const once = rotateSignature(sig);
    expect(once).toMatchObject({ rotation: 90, w: 60, h: 180, x: 160, y: 140 });
    // same centre
    expect(once.x + once.w / 2).toBe(sig.x + sig.w / 2);
    expect(once.y + once.h / 2).toBe(sig.y + sig.h / 2);
    // the picture keeps its own size
    expect(signatureImageSize(once)).toEqual({ w: 180, h: 60 });
    const back = rotateSignature(rotateSignature(rotateSignature(once)));
    expect(back).toMatchObject({ rotation: 0, x: 100, y: 200, w: 180, h: 60 });
  });
});
