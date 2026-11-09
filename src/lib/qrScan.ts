'use client';
// Reading QR codes and barcodes in the browser (the app: ML Kit's barcode scanner, all formats). Chrome on Android,
// macOS and ChromeOS has a built-in BarcodeDetector; everywhere else (Windows, Firefox, Safari) the same API comes from
// barcode-detector (MIT), ZXing-C++ in WebAssembly, served from /zxing (scripts/copy-pdfjs.mjs), never a CDN.
import { parseCode, type ScanResult } from '@/tools/qr';

type Detected = { rawValue: string; format: string };
type Detector = { detect(src: ImageBitmapSource): Promise<Detected[]> };

const PRODUCT = new Set(['ean_13', 'ean_8', 'upc_a', 'upc_e']);
let made: Promise<Detector> | null = null;

async function detector(): Promise<Detector> {
  const native = (globalThis as unknown as { BarcodeDetector?: { new (o?: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector;
  if (native) {
    try {
      const formats = await native.getSupportedFormats();
      if (formats.includes('qr_code')) return new native({ formats });
    } catch {
      // fall through to ZXing
    }
  }
  const { BarcodeDetector, setZXingModuleOverrides } = await import('barcode-detector/ponyfill');
  setZXingModuleOverrides({ locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? `/zxing/${path}` : prefix + path) });
  return new BarcodeDetector() as unknown as Detector;
}

/** Every code in an image or video frame, read into the app's typed results (src/tools/qr.ts parseCode). */
export async function readCodes(src: ImageBitmapSource): Promise<ScanResult[]> {
  made ??= detector();
  const d = await made;
  const found = await d.detect(src);
  return found.filter((c) => c.rawValue).map((c) => parseCode(c.rawValue, PRODUCT.has(c.format)));
}
