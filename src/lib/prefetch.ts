'use client';
// Gets the in-browser AI tools' files ready in the background (the app does the same at launch: SegmenterModule
// prepare), so a tool starts at once instead of downloading when the person is waiting. Only the files are fetched
// and kept by the browser; nothing is loaded into memory until a tool opens.
//
// Polite: a few seconds after the page loads, when the browser is idle, one file at a time, low priority; never with
// Data Saver on or on a slow (2G / 3G) connection; LaMa (208 MB, Object eraser) only on Wi-Fi / Ethernet (or a
// connection that doesn't say) and only with room to spare. Each file is fetched once: later visits find it cached.
// Where each tool keeps its files:
//   transformers.js models (ormbg, Swin2SR): Cache Storage "transformers-cache", keyed by the Hugging Face URL
//   LaMa: Cache Storage "zipyzee-models" (src/lib/inpaint.ts)
//   MediaPipe's model and our own /ort, /mediapipe files: the browser's HTTP cache
const HF = 'https://huggingface.co/';
const hf = (model: string, file: string) => `${HF}${model}/resolve/main/${file}`;

type Item = { url: string; cache?: string; big?: boolean };

/** What each model-based tool needs (the same model ids and file kinds the tools load). */
function items(): Item[] {
  const tf = 'transformers-cache';
  const model = (id: string, onnx: string): Item[] => [
    { url: hf(id, 'config.json'), cache: tf },
    { url: hf(id, 'preprocessor_config.json'), cache: tf },
    { url: hf(id, `onnx/${onnx}`), cache: tf },
  ];
  return [
    // Passport photo, Blur faces: MediaPipe face finder (~230 KB) and its WebAssembly
    { url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite' },
    { url: '/mediapipe/vision_wasm_internal.wasm' },
    { url: '/mediapipe/vision_wasm_internal.js' },
    // Background remover, Change background, Passport photo, Sticker maker: ormbg 8-bit (44 MB, src/lib/segment.ts)
    ...model('onnx-community/ormbg-ONNX', 'model_quantized.onnx'),
    // Upscale image 2x / 4x (src/lib/upscale.ts on WebAssembly: 8-bit)
    ...model('Xenova/swin2SR-lightweight-x2-64', 'model_quantized.onnx'),
    ...model('Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr', 'model_quantized.onnx'),
    // Object eraser: ONNX Runtime's WebAssembly and LaMa (208 MB)
    { url: '/ort/ort-wasm-simd-threaded.jsep.wasm', big: true },
    { url: '/ort/ort-wasm-simd-threaded.jsep.mjs', big: true },
    { url: 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx', cache: 'zipyzee-models', big: true },
  ];
}

type Connection = { saveData?: boolean; effectiveType?: string; type?: string };

function allowed(): { any: boolean; big: boolean } {
  const c = (navigator as unknown as { connection?: Connection }).connection;
  if (c?.saveData || /(^|-)(2g|3g)$/.test(c?.effectiveType ?? '')) return { any: false, big: false };
  const metered = c?.type === 'cellular' || c?.type === 'bluetooth' || c?.type === 'wimax';
  return { any: true, big: !metered };
}

async function roomFor(bytes: number) {
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    return quota - usage > bytes * 2;
  } catch {
    return true;
  }
}

async function fetchOne(item: Item): Promise<void> {
  if (item.cache) {
    const cache = await caches.open(item.cache);
    if (await cache.match(item.url)) return;
    const res = await fetch(item.url, { priority: 'low' } as RequestInit);
    if (res.ok) await cache.put(item.url, res);
    return;
  }
  // the HTTP cache keeps it (the response is read to the end so it's stored)
  const res = await fetch(item.url, { priority: 'low' } as RequestInit);
  await res.arrayBuffer();
}

let started = false;

/** Starts the background downloads once per page load (the home page and every page call it; it runs once). */
export function prefetchModels() {
  if (started || typeof window === 'undefined' || typeof caches === 'undefined') return;
  started = true;
  const go = async () => {
    const ok = allowed();
    if (!ok.any) return;
    const big = ok.big && (await roomFor(260 * 1024 * 1024));
    for (const item of items()) {
      if (item.big && !big) continue;
      // a tool the person opened meanwhile downloads its own files; this just carries on with the rest
      try {
        await fetchOne(item);
      } catch {
        // offline or blocked: the tool downloads it when used, as before
      }
      if (!allowed().any) return;
    }
  };
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 10000 }) : setTimeout(cb, 1000));
  const start = () => setTimeout(() => idle(() => void go()), 4000);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
