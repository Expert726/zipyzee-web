import { describe, expect, it } from 'vitest';
import { distinctLayouts, fitSource, layoutRects, panned } from '@/tools/image/collageFit';

describe('Collage layouts (web)', () => {
  it('offers only layouts that look different, for 2 to 9 photos', () => {
    for (let n = 2; n <= 9; n++) {
      const list = distinctLayouts(n);
      const keys = list.map((l) => JSON.stringify(layoutRects(n, l, 100, 100, 2).map((r) => [r.x, r.y, r.w, r.h].map(Math.round)).sort()));
      expect(new Set(keys).size).toBe(list.length);
      expect(list.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps every photo inside the collage, one cell per photo', () => {
    for (let n = 2; n <= 9; n++)
      for (const l of distinctLayouts(n)) {
        const rects = layoutRects(n, l, 1000, 800, 10);
        expect(rects).toHaveLength(n);
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(9.99);
          expect(r.y).toBeGreaterThanOrEqual(9.99);
          expect(r.x + r.w).toBeLessThanOrEqual(990.01);
          expect(r.y + r.h).toBeLessThanOrEqual(790.01);
        }
      }
  });

  it('big left gives the big photo 60%, unlike two columns', () => {
    const [big, small] = layoutRects(2, 'bigLeft', 1000, 1000, 0);
    expect(big.w).toBeCloseTo(600);
    expect(small.w).toBeCloseTo(400);
  });

  it('zoom and drag stay inside the photo', () => {
    const f = panned(4000, 3000, 500, 500, { zoom: 2, fx: 0.5, fy: 0.5 }, 10000, 10000, 250);
    const s = fitSource(4000, 3000, 500, 500, f);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w).toBeLessThanOrEqual(4000.01);
    expect(s.y + s.h).toBeLessThanOrEqual(3000.01);
  });
});
