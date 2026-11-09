import { describe, expect, it } from 'vitest';
import { homography, isConvex, orderCorners, project, quadArea, quadSize, type Quad } from '@/tools/scanQuad';

describe('Scan corners', () => {
  it('orders four points as top-left, top-right, bottom-right, bottom-left', () => {
    const q = orderCorners([{ x: 0.9, y: 0.85 }, { x: 0.1, y: 0.1 }, { x: 0.12, y: 0.9 }, { x: 0.88, y: 0.12 }]);
    expect(q).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.88, y: 0.12 }, { x: 0.9, y: 0.85 }, { x: 0.12, y: 0.9 }]);
  });

  it('tells a proper shape from a twisted one', () => {
    const ok: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const twisted: Quad = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
    expect(isConvex(ok)).toBe(true);
    expect(isConvex(twisted)).toBe(false);
    expect(quadArea(ok)).toBeCloseTo(1);
  });

  it('maps the page corners onto the photo corners (and points between them)', () => {
    const page = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 140 }, { x: 0, y: 140 }];
    const photo = [{ x: 30, y: 20 }, { x: 410, y: 60 }, { x: 380, y: 590 }, { x: 10, y: 540 }];
    const h = homography(page, photo);
    page.forEach((p, i) => {
      const q = project(h, p.x, p.y);
      expect(q.x).toBeCloseTo(photo[i].x, 6);
      expect(q.y).toBeCloseTo(photo[i].y, 6);
    });
  });

  it('sizes the straightened page from its longer edges', () => {
    const q: Quad = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.8, y: 0.9 }, { x: 0.2, y: 0.9 }];
    expect(quadSize(q, 1000, 1000)).toEqual({ w: 800, h: expect.closeTo(806.2, 1) });
  });
});
