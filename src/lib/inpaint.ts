'use client';
// Object eraser in the browser (the app sends it to the server, which runs the same model): big-LaMa (Apache-2.0,
// Carve/LaMa-ONNX lama_fp32.onnx, 512 x 512 in and out), run by ONNX Runtime Web on
// WebAssembly only (served from /ort, scripts/copy-pdfjs.mjs; WebGPU fails on its Fourier blocks). The model (208 MB) is downloaded once and kept in the
// browser's Cache Storage. Chosen by the user over a no-download fill (2026-11-07).
//
// Only the part of the photo around each painted object goes through the model (a square about twice the object's
// size, made 512 x 512), and only the painted area of the answer is pasted back with a soft edge, so the rest of
// the photo keeps its full sharpness. Objects far apart are done one at a time.
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';

const MODEL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const CACHE = 'zipyzee-models';
const SIZE = 512;

/** A brush stroke in 0-1 of the photo; s = brush size as a share of the photo's short side (the app's EraseStroke). */
export type EraseStroke = { s: number; p: [number, number][] };

type Ort = typeof import('onnxruntime-web');
type Session = Awaited<ReturnType<Ort['InferenceSession']['create']>>;
let loading: Promise<{ ort: Ort; session: Session }> | null = null;

/** The model's bytes: from the cache, or downloaded (with progress) and cached. */
async function modelBytes(onDownload?: (pct: number) => void): Promise<Uint8Array> {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null;
  const hit = await cache?.match(MODEL);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const res = await fetch(MODEL);
  if (!res.ok || !res.body) throw new Error(`model ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 208_000_000;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onDownload?.(Math.min(99, Math.round((got / total) * 100)));
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  await cache?.put(MODEL, new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return bytes;
}

async function load(onDownload?: (pct: number) => void) {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.wasmPaths = '/ort/';
  const bytes = await modelBytes(onDownload);
  // WebAssembly only: on WebGPU the model's Fourier blocks fail ("[WebGPU] Kernel [Add] …/ffc/convg2g/Add failed:
  // Can't perform binary op", 2026-11-07). Several threads when the page allows them (cross-origin isolated).
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return { ort, session };
}

type Rect = { x: number; y: number; w: number; h: number };

/** The box around a stroke in photo px (with its brush). */
function strokeBox(st: EraseStroke, W: number, H: number): Rect {
  const r = (st.s * Math.min(W, H)) / 2;
  const xs = st.p.map((p) => p[0] * W);
  const ys = st.p.map((p) => p[1] * H);
  const x = Math.min(...xs) - r;
  const y = Math.min(...ys) - r;
  return { x, y, w: Math.max(...xs) + r - x, h: Math.max(...ys) + r - y };
}

const grow = (b: Rect, by: number): Rect => ({ x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 });
const meets = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Strokes in groups that are near each other (each group is one pass of the model). */
export function strokeGroups(strokes: EraseStroke[], W: number, H: number): { box: Rect; strokes: EraseStroke[] }[] {
  const groups: { box: Rect; strokes: EraseStroke[] }[] = [];
  for (const st of strokes.filter((s) => s.p.length)) {
    let g = { box: strokeBox(st, W, H), strokes: [st] };
    // merge with every group it comes near (a merge can bring others near too)
    for (let i = groups.length - 1; i >= 0; i--) {
      const o = groups[i];
      const pad = Math.max(o.box.w, o.box.h, g.box.w, g.box.h) * 0.5;
      if (meets(grow(o.box, pad), g.box)) {
        g = { box: union(o.box, g.box), strokes: [...o.strokes, ...g.strokes] };
        groups.splice(i, 1);
      }
    }
    groups.push(g);
  }
  return groups;
}

/** The square to send to the model: about twice the object, at least 256 px, inside the photo. */
function regionOf(box: Rect, W: number, H: number): Rect {
  const side = Math.min(Math.max(W, H), Math.max(256, Math.max(box.w, box.h) * 2));
  const w = Math.min(W, side);
  const h = Math.min(H, side);
  const x = Math.round(Math.min(Math.max(0, box.x + box.w / 2 - w / 2), W - w));
  const y = Math.round(Math.min(Math.max(0, box.y + box.h / 2 - h / 2), H - h));
  return { x, y, w: Math.round(w), h: Math.round(h) };
}

/** Draws the strokes (in photo px, a little wider: LaMa does better with some room) on g, shifted by -off. */
function paintStrokes(g: CanvasRenderingContext2D, strokes: EraseStroke[], W: number, H: number, off: { x: number; y: number }, scale: number, extra: number) {
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const st of strokes) {
    g.lineWidth = (st.s * Math.min(W, H) * 1.1 + extra) * scale;
    g.beginPath();
    g.moveTo((st.p[0][0] * W - off.x) * scale, (st.p[0][1] * H - off.y) * scale);
    if (st.p.length === 1) g.lineTo((st.p[0][0] * W - off.x) * scale + 0.1, (st.p[0][1] * H - off.y) * scale);
    for (const [x, y] of st.p.slice(1)) g.lineTo((x * W - off.x) * scale, (y * H - off.y) * scale);
    g.stroke();
  }
}

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/**
 * The photo with every painted object filled in. onProgress(done, total) per object group (0 before the first);
 * onDownload(%) while the model downloads (first use only).
 */
export async function eraseObjects(photo: HTMLCanvasElement, strokes: EraseStroke[], onProgress: (done: number, total: number) => Promise<void> | void, onDownload?: (pct: number) => void): Promise<HTMLCanvasElement> {
  let model: { ort: Ort; session: Session };
  try {
    loading ??= load(onDownload);
    model = await loading;
  } catch (e) {
    loading = null;
    console.error(e);
    throw new ToolError(navigator.onLine ? t('The eraser couldn\'t load on this browser. Try Chrome or Edge on a computer.') : t('The eraser downloads once (about 208 MB). Connect to the internet and try again.'));
  }
  const { ort, session } = model;
  const W = photo.width;
  const H = photo.height;
  const out = canvas(W, H);
  const og = out.getContext('2d')!;
  og.drawImage(photo, 0, 0);
  const groups = strokeGroups(strokes, W, H);

  for (let gi = 0; gi < groups.length; gi++) {
    await onProgress(gi, groups.length);
    const grp = groups[gi];
    const reg = regionOf(grp.box, W, H);

    // the region of the photo so far (earlier objects already erased) and its mask, at 512 x 512
    const img = canvas(SIZE, SIZE);
    const ig = img.getContext('2d', { willReadFrequently: true })!;
    ig.imageSmoothingQuality = 'high';
    ig.drawImage(out, reg.x, reg.y, reg.w, reg.h, 0, 0, SIZE, SIZE);
    const msk = canvas(SIZE, SIZE);
    const mg = msk.getContext('2d', { willReadFrequently: true })!;
    // (a region at the photo's edge may not be square: it is stretched to the square, the mask the same way)
    mg.scale(SIZE / reg.w, SIZE / reg.h);
    paintStrokes(mg, grp.strokes, W, H, reg, 1, 6);

    const px = ig.getImageData(0, 0, SIZE, SIZE).data;
    const mp = mg.getImageData(0, 0, SIZE, SIZE).data;
    const n = SIZE * SIZE;
    const image = new Float32Array(3 * n);
    const mask = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      image[i] = px[i * 4] / 255;
      image[n + i] = px[i * 4 + 1] / 255;
      image[2 * n + i] = px[i * 4 + 2] / 255;
      mask[i] = mp[i * 4 + 3] > 0 ? 1 : 0;
    }
    let result: Float32Array;
    try {
      const res = await session.run({ image: new ort.Tensor('float32', image, [1, 3, SIZE, SIZE]), mask: new ort.Tensor('float32', mask, [1, 1, SIZE, SIZE]) });
      result = (res[session.outputNames[0]].data as Float32Array);
    } catch (e) {
      console.error(e);
      throw new ToolError(t('The photo couldn\'t be erased on this device. Try a smaller photo or another browser.'));
    }
    // the model's answer (0-255) as pixels
    const ans = ig.createImageData(SIZE, SIZE);
    for (let i = 0; i < n; i++) {
      ans.data[i * 4] = result[i];
      ans.data[i * 4 + 1] = result[n + i];
      ans.data[i * 4 + 2] = result[2 * n + i];
      ans.data[i * 4 + 3] = 255;
    }
    ig.putImageData(ans, 0, 0);

    // back at the region's size, kept only where it was painted (soft edge), over the photo
    const back = canvas(reg.w, reg.h);
    const bg = back.getContext('2d')!;
    bg.imageSmoothingQuality = 'high';
    bg.drawImage(img, 0, 0, SIZE, SIZE, 0, 0, reg.w, reg.h);
    const keep = canvas(reg.w, reg.h);
    const kg = keep.getContext('2d')!;
    const soft = Math.max(1, Math.round(Math.min(reg.w, reg.h) / 200));
    kg.filter = `blur(${soft}px)`;
    paintStrokes(kg, grp.strokes, W, H, reg, 1, 6 + soft * 2);
    bg.globalCompositeOperation = 'destination-in';
    bg.drawImage(keep, 0, 0);
    og.drawImage(back, reg.x, reg.y);
    for (const c of [img, msk, back, keep]) c.width = c.height = 0;
  }
  return out;
}
