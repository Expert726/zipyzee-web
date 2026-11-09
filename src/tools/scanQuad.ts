// Page corners for Smart scan and ID card scan on the web (pure, unit-tested). The app gets cropped, straightened
// pages from Google's ML Kit document scanner; the web finds the paper's four corners itself (src/lib/docScan.ts),
// lets the person drag them, and straightens the page with the homography below.

export type Pt = { x: number; y: number };
/** Top-left, top-right, bottom-right, bottom-left; in 0-1 of the photo. */
export type Quad = [Pt, Pt, Pt, Pt];

/** The whole photo, a little inside its edges (when no paper is found). */
export const DEFAULT_QUAD: Quad = [
  { x: 0.04, y: 0.04 },
  { x: 0.96, y: 0.04 },
  { x: 0.96, y: 0.96 },
  { x: 0.04, y: 0.96 },
];
export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

/** Four points in reading order: the corners nearest top-left, top-right, bottom-right, bottom-left. */
export function orderCorners(pts: Pt[]): Quad {
  const by = (f: (p: Pt) => number, max: boolean) => pts.reduce((a, b) => ((max ? f(b) > f(a) : f(b) < f(a)) ? b : a));
  return [by((p) => p.x + p.y, false), by((p) => p.x - p.y, true), by((p) => p.x + p.y, true), by((p) => p.x - p.y, false)];
}

const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** True when the four corners make a proper (convex, non-twisted) shape. */
export function isConvex(q: Quad): boolean {
  const s = q.map((p, i) => Math.sign(cross(p, q[(i + 1) % 4], q[(i + 2) % 4])));
  return s.every((v) => v !== 0 && v === s[0]);
}

/** Area as a share of the photo (corners in 0-1). */
export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) a += q[i].x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * q[i].y;
  return Math.abs(a) / 2;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** The straightened page's size in photo pixels: the longer of each pair of opposite edges. */
export function quadSize(q: Quad, imgW: number, imgH: number): { w: number; h: number } {
  const p = q.map((c) => ({ x: c.x * imgW, y: c.y * imgH }));
  return { w: Math.max(dist(p[0], p[1]), dist(p[3], p[2])), h: Math.max(dist(p[0], p[3]), dist(p[1], p[2])) };
}

/**
 * The 3x3 projective map (row-major, last entry 1) taking each `from` point to the matching `to` point. Used from the
 * output page to the photo, so every output pixel looks up where it comes from.
 */
export function homography(from: Pt[], to: Pt[]): number[] {
  // 8 equations, 8 unknowns: Gaussian elimination with partial pivoting
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row) => row[8]), 1];
}

export function project(h: number[], x: number, y: number): Pt {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}
