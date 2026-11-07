'use client';
// Upscale image in the browser (the app sends it to the server): Swin2SR (Apache-2.0), run by transformers.js on
// WebGPU or WebAssembly. 2x: the lightweight model (~7 MB); 4x: the real-world model (~21 MB, made for phone photos
// with noise and JPEG blur). Downloaded once from Hugging Face and kept by the browser. The photo is done in tiles
// (with an overlap, so no seams show), which keeps memory low.
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';

const MODELS = { 2: 'Xenova/swin2SR-lightweight-x2-64', 4: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr' } as const;
export type Scale = keyof typeof MODELS;
/** Biggest input side per scale (the output is then at most 3000 px). */
export const MAX_INPUT: Record<Scale, number> = { 2: 1500, 4: 750 };

const TILE = 128;
const PAD = 8;

type Pipe = (img: unknown) => Promise<{ toCanvas(): HTMLCanvasElement | OffscreenCanvas }>;
const pipes = new Map<Scale, Promise<Pipe>>();

async function load(scale: Scale, onDownload?: (pct: number) => void): Promise<Pipe> {
  const tf = await import('@huggingface/transformers');
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    const all = [...files.values()];
    onDownload?.(Math.round((all.reduce((n, f) => n + f.loaded, 0) / all.reduce((n, f) => n + f.total, 0)) * 100));
  };
  const gpu = 'gpu' in navigator;
  const make = (device: 'webgpu' | 'wasm') =>
    tf.pipeline('image-to-image', MODELS[scale], { device, dtype: device === 'webgpu' ? 'fp16' : 'q8', progress_callback }) as unknown as Promise<Pipe>;
  try {
    return await make(gpu ? 'webgpu' : 'wasm');
  } catch {
    return make('wasm');
  }
}

/** The photo `scale` times bigger. onProgress(done, total) per tile; onDownload(%) while the model downloads. */
export async function upscale(src: HTMLCanvasElement, scale: Scale, onProgress: (done: number, total: number) => Promise<void> | void, onDownload?: (pct: number) => void): Promise<HTMLCanvasElement> {
  if (Math.max(src.width, src.height) > MAX_INPUT[scale]) {
    throw new ToolError(t('This photo is already large. {scale}x works on photos up to {px} px on the long side.', { scale, px: MAX_INPUT[scale] }));
  }
  let pipe: Pipe;
  try {
    if (!pipes.has(scale)) pipes.set(scale, load(scale, onDownload));
    pipe = await pipes.get(scale)!;
  } catch {
    pipes.delete(scale);
    throw new ToolError(t('The upscaler couldn\'t load. Check your internet and try again.'));
  }
  const tf = await import('@huggingface/transformers');
  const out = document.createElement('canvas');
  out.width = src.width * scale;
  out.height = src.height * scale;
  const og = out.getContext('2d')!;
  const sg = src.getContext('2d')!;
  const cols = Math.ceil(src.width / TILE);
  const rows = Math.ceil(src.height / TILE);
  let done = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      await onProgress(done++, cols * rows);
      // the tile with a little of its neighbours around it
      const x0 = c * TILE;
      const y0 = r * TILE;
      const x1 = Math.min(src.width, x0 + TILE);
      const y1 = Math.min(src.height, y0 + TILE);
      const px0 = Math.max(0, x0 - PAD);
      const py0 = Math.max(0, y0 - PAD);
      const px1 = Math.min(src.width, x1 + PAD);
      const py1 = Math.min(src.height, y1 + PAD);
      const data = sg.getImageData(px0, py0, px1 - px0, py1 - py0);
      const raw = new tf.RawImage(data.data, data.width, data.height, 4).rgb();
      const res = (await pipe(raw)).toCanvas();
      // keep only the tile itself (the overlap was there to avoid seams)
      og.drawImage(res as CanvasImageSource, (x0 - px0) * scale, (y0 - py0) * scale, (x1 - x0) * scale, (y1 - y0) * scale, x0 * scale, y0 * scale, (x1 - x0) * scale, (y1 - y0) * scale);
    }
  }
  return out;
}
