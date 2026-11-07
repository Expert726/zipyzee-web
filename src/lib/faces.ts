'use client';
// Faces in a photo (the app's ML Kit face detection), in the browser: MediaPipe's face detector (Apache-2.0). Its
// WebAssembly is served from /mediapipe (scripts/copy-pdfjs.mjs); the small model (~230 KB) comes from Google's
// model storage on first use. Boxes in the photo's pixels.
import type { Box } from '@/tools/image/passport';

const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

type Detector = { detect(img: HTMLCanvasElement | ImageBitmap): { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] } };
let loading: Promise<Detector> | null = null;

async function load(): Promise<Detector> {
  const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks('/mediapipe');
  return FaceDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 });
}

/**
 * MediaPipe's WebAssembly prints its start-up notes ("INFO: Created TensorFlow Lite XNNPACK delegate for CPU.",
 * "W1107 … inference_feedback_manager …") through console.error / console.warn, which the Next.js dev overlay counts
 * as errors. While it runs, those lines (and only those) are dropped; everything else still goes through.
 */
const NOTE = /^(INFO: |[IW]\d{4} \d)/;
async function quietly<T>(run: () => T | Promise<T>): Promise<T> {
  const { error, warn, info, log } = console;
  const pass = (orig: (...a: unknown[]) => void) => (...a: unknown[]) => {
    if (typeof a[0] === 'string' && NOTE.test(a[0])) return;
    orig(...a);
  };
  console.error = pass(error);
  console.warn = pass(warn);
  console.info = pass(info);
  console.log = pass(log);
  try {
    return await run();
  } finally {
    Object.assign(console, { error, warn, info, log });
  }
}

export async function detectFaces(img: HTMLCanvasElement | ImageBitmap): Promise<Box[]> {
  try {
    loading ??= quietly(load);
    const d = await loading;
    return (await quietly(() => d.detect(img))).detections.flatMap((x) => (x.boundingBox ? [{ x: x.boundingBox.originX, y: x.boundingBox.originY, w: x.boundingBox.width, h: x.boundingBox.height }] : []));
  } catch (e) {
    loading = null;
    throw e;
  }
}

const overlap = (a: Box, b: Box) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0;
};

/**
 * Every face, small ones too (Blur faces: group photos, a crowd). The detector looks at a small copy of the photo,
 * so it also looks at 3 x 3 overlapping parts of it; a face found twice is kept once.
 */
export async function detectAllFaces(img: HTMLCanvasElement): Promise<Box[]> {
  const found = await detectFaces(img);
  const n = 3;
  const tw = img.width / 2;
  const th = img.height / 2;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = (c * (img.width - tw)) / (n - 1);
      const y = (r * (img.height - th)) / (n - 1);
      const part = document.createElement('canvas');
      part.width = Math.round(tw);
      part.height = Math.round(th);
      part.getContext('2d')!.drawImage(img, x, y, tw, th, 0, 0, part.width, part.height);
      for (const f of await detectFaces(part)) {
        const b = { x: f.x + x, y: f.y + y, w: f.w, h: f.h };
        if (!found.some((o) => overlap(o, b) > 0.4)) found.push(b);
      }
      part.width = part.height = 0;
    }
  }
  return found;
}
