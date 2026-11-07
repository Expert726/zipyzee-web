'use client';
// The subject in a photo (the app's Segmenter, ML Kit there), in the browser: ormbg (Apache-2.0, an ISNet model made
// for background removal; onnx-community/ormbg-ONNX, the 8-bit model, 44 MB), run by transformers.js (Apache-2.0)
// on WebAssembly, on several cores where the page is cross-origin isolated (src/lib/isolated.ts). Downloaded from
// Hugging Face on first use and kept by the browser; the photo never leaves the page.
//
// Was BiRefNet lite (2026-11-07, 115 MB): ~16 s per photo on one CPU core, it failed on WebGPU ("Too many storage
// buffers in shader") and ran out of WebAssembly memory on several cores (std::bad_alloc). Measured on this Mac
// (onnxruntime-node, 4 cores, the user's parrot photo): ormbg 0.7 s, BiRefNet 10.7 s, the two masks nearly the same.
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';

const MODEL = 'onnx-community/ormbg-ONNX';

type Model = { run: (img: ImageBitmap | HTMLCanvasElement) => Promise<Uint8ClampedArray> };
let loading: Promise<Model> | null = null;

/** 0-100 while the model downloads (first use only). */
export type OnProgress = (percent: number) => void;

async function load(onProgress?: OnProgress): Promise<Model> {
  const tf = await import('@huggingface/transformers');
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    const all = [...files.values()];
    onProgress?.(Math.round((all.reduce((n, f) => n + f.loaded, 0) / all.reduce((n, f) => n + f.total, 0)) * 100));
  };
  const model = await tf.AutoModel.from_pretrained(MODEL, { dtype: 'q8', device: 'wasm', progress_callback });
  const processor = await tf.AutoProcessor.from_pretrained(MODEL, {});
  console.info(`[segment] ormbg on wasm, ${globalThis.crossOriginIsolated ? 'several cores' : 'one core'}`);
  type Tensor = { mul(n: number): Tensor; to(t: string): Tensor };
  const m = model as unknown as (inputs: Record<string, unknown>) => Promise<Record<string, Tensor & Tensor[]>>;

  return {
    async run(img) {
      // the photo as a RawImage (RGB)
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const rgba = g.getImageData(0, 0, c.width, c.height).data;
      const raw = new tf.RawImage(rgba, c.width, c.height, 4).rgb();
      const { pixel_values } = (await processor(raw)) as { pixel_values: unknown };
      const out = await m({ pixel_values });
      // alphas: 0-1 already (no sigmoid needed)
      const alphas = (out.alphas ?? Object.values(out)[0]) as Tensor & Tensor[];
      const mask = await tf.RawImage.fromTensor(alphas[0].mul(255).to('uint8') as never);
      const sized = await mask.resize(c.width, c.height);
      // one channel, 0 = background, 255 = subject
      const data = sized.data as Uint8ClampedArray | Uint8Array;
      const ch = sized.channels ?? 1;
      const alpha = new Uint8ClampedArray(c.width * c.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * ch];
      return alpha;
    },
  };
}

/** The subject's mask for a photo: one byte per pixel (0-255), the photo's size. */
export async function subjectMask(img: ImageBitmap | HTMLCanvasElement, onProgress?: OnProgress): Promise<Uint8ClampedArray> {
  try {
    loading ??= load(onProgress);
    const model = await loading;
    return await model.run(img);
  } catch (e) {
    loading = null;
    if (!navigator.onLine) throw new ToolError(t('The background tool is downloading (one time). Stay online for a minute, then try again.'));
    console.error(e);
    throw new ToolError(t('Couldn\'t find the subject in this photo. Try another one.'));
  }
}
