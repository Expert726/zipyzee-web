'use client';
// Scanning a photo of paper in the browser (the app uses Google's ML Kit document scanner): find the paper's corners,
// straighten it (perspective), turn it and clean it up with the app's filters (src/tools/scan.ts FILTER_MATRIX). No
// library: a small copy of the photo is split into paper and background (Otsu), the biggest region that isn't the
// background is the paper, and its extreme points are the corners. Geometry: src/tools/scanQuad.ts.
import { drawTurned } from './turnImage';
import { FILTER_MATRIX, type Rotation, type ScanFilter } from '@/tools/scan';
import { DEFAULT_QUAD, homography, isConvex, orderCorners, project, quadArea, quadSize, type Quad } from '@/tools/scanQuad';

const SMALL = 360;

/** Otsu's threshold for 8-bit grey levels. */
function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const g of gray) hist[g]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let at = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      at = i;
    }
  }
  return at;
}

/** The biggest 4-connected region of `on` pixels: its pixels' indexes and how many touch the photo's edge. */
function biggestRegion(on: Uint8Array, w: number, h: number): { pixels: number[]; edge: number } | null {
  const seen = new Uint8Array(on.length);
  let best: { pixels: number[]; edge: number } | null = null;
  const stack: number[] = [];
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || seen[start]) continue;
    const pixels: number[] = [];
    let edge = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      pixels.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge++;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && on[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (!best || pixels.length > best.pixels.length) best = { pixels, edge };
  }
  return best;
}

/** Where the paper's corners probably are (0-1 of the photo); a frame just inside the photo when unsure. */
export function findCorners(photo: HTMLCanvasElement | ImageBitmap): Quad {
  const k = Math.min(1, SMALL / Math.max(photo.width, photo.height));
  const w = Math.max(8, Math.round(photo.width * k));
  const h = Math.max(8, Math.round(photo.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.filter = 'blur(2px)';
  g.drawImage(photo, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) >> 8;
  const t = otsu(gray);
  let best: { quad: Quad; score: number } | null = null;
  // paper is usually lighter than the table; try the darker side too (a white document on a white desk won't split)
  for (const light of [true, false]) {
    const on = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) on[i] = light ? +(gray[i] > t) : +(gray[i] <= t);
    const r = biggestRegion(on, w, h);
    if (!r) continue;
    const share = r.pixels.length / gray.length;
    if (share < 0.12 || share > 0.97) continue;
    const pts = r.pixels.map((i) => ({ x: (i % w) / (w - 1), y: ((i / w) | 0) / (h - 1) }));
    const quad = orderCorners(pts);
    const area = quadArea(quad);
    if (!isConvex(quad) || area < 0.12) continue;
    // a region that fills its corners well and barely touches the photo's edge looks most like a sheet
    const fill = share / area;
    const edgeShare = r.edge / (2 * (w + h));
    const score = area * Math.min(1, fill) * (1 - edgeShare);
    if (!best || score > best.score) best = { quad, score };
  }
  c.width = c.height = 0;
  return best?.quad ?? DEFAULT_QUAD;
}

/** The page inside `quad` straightened into a rectangle, at most `maxSide` px on its long side. */
export function straighten(photo: HTMLCanvasElement, quad: Quad, maxSide = 2400, size?: { w: number; h: number }): HTMLCanvasElement {
  const W = photo.width;
  const H = photo.height;
  const s = size ?? quadSize(quad, W, H);
  const k = Math.min(1, maxSide / Math.max(s.w, s.h));
  const ow = Math.max(1, Math.round(s.w * k));
  const oh = Math.max(1, Math.round(s.h * k));
  const src = photo.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const og = out.getContext('2d')!;
  const img = og.createImageData(ow, oh);
  const o = img.data;
  const corners = quad.map((p) => ({ x: p.x * (W - 1), y: p.y * (H - 1) }));
  const map = homography([{ x: 0, y: 0 }, { x: ow - 1, y: 0 }, { x: ow - 1, y: oh - 1 }, { x: 0, y: oh - 1 }], corners);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const p = project(map, x, y);
      const x0 = Math.max(0, Math.min(W - 2, Math.floor(p.x)));
      const y0 = Math.max(0, Math.min(H - 2, Math.floor(p.y)));
      const fx = Math.max(0, Math.min(1, p.x - x0));
      const fy = Math.max(0, Math.min(1, p.y - y0));
      const i00 = (y0 * W + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + W * 4;
      const i11 = i01 + 4;
      const j = (y * ow + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx;
        const bot = src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx;
        o[j + ch] = top * (1 - fy) + bot * fy;
      }
      o[j + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

/** The app's colour matrix on every pixel (Original leaves it as it is). */
export function applyFilter(c: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  if (filter === 'original') return c;
  const m = FILTER_MATRIX[filter];
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255;
    const gg = d[i + 1] / 255;
    const b = d[i + 2] / 255;
    for (let row = 0; row < 3; row++) {
      const v = m[row * 5] * r + m[row * 5 + 1] * gg + m[row * 5 + 2] * b + m[row * 5 + 3] + m[row * 5 + 4];
      d[i + row] = Math.max(0, Math.min(255, v * 255));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export type ScanPageIn = { photo: HTMLCanvasElement; quad: Quad; rotation: Rotation };

/** One finished page: straightened, turned, filtered. */
export function renderScanPage(p: ScanPageIn, filter: ScanFilter, maxSide = 2400): HTMLCanvasElement {
  const flat = straighten(p.photo, p.quad, maxSide);
  const turned = p.rotation ? drawTurned(flat, p.rotation, false) : flat;
  if (turned !== flat) flat.width = flat.height = 0;
  return applyFilter(turned, filter);
}

/** A picked photo ready to scan: upright (EXIF), at most `maxSide`, with its corners found. */
export async function loadScanPhoto(file: File, maxSide = 2400): Promise<ScanPageIn> {
  const { decodeImage } = await import('./image');
  const bmp = await decodeImage(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return { photo: c, quad: findCorners(c), rotation: 0 };
}
