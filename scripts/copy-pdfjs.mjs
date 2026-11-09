// Copies pdf.js's worker, character maps and standard fonts into public/pdfjs, and MediaPipe's wasm into
// public/mediapipe and ONNX Runtime's into public/ort (served as static files), so the
// browser loads the same version the code imports. Runs before dev and build (package.json); the folder is ignored.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const out = join(process.cwd(), 'public', 'pdfjs');
mkdirSync(out, { recursive: true });
cpSync(join(root, 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'));
cpSync(join(root, 'cmaps'), join(out, 'cmaps'), { recursive: true });
cpSync(join(root, 'standard_fonts'), join(out, 'standard_fonts'), { recursive: true });
// MediaPipe's WebAssembly for face finding (Passport photo), served from /mediapipe
const mp = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const mpOut = join(process.cwd(), 'public', 'mediapipe');
mkdirSync(mpOut, { recursive: true });
cpSync(mp, mpOut, { recursive: true });
// ONNX Runtime's WebAssembly for Object eraser (LaMa, src/lib/inpaint.ts), served from /ort
const ort = join(process.cwd(), 'node_modules', 'onnxruntime-web', 'dist');
const ortOut = join(process.cwd(), 'public', 'ort');
mkdirSync(ortOut, { recursive: true });
for (const f of readdirSync(ort)) if (/^ort-wasm.*\.(wasm|mjs)$/.test(f)) cpSync(join(ort, f), join(ortOut, f));
// ZXing's WebAssembly for QR and barcode scanning where the browser has no BarcodeDetector (src/lib/qrScan.ts)
const zx = join(process.cwd(), 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm');
const zxOut = join(process.cwd(), 'public', 'zxing');
mkdirSync(zxOut, { recursive: true });
cpSync(zx, join(zxOut, 'zxing_reader.wasm'));
// Tesseract.js's worker and WebAssembly core for reading text (src/lib/ocr.ts), served from /tesseract
const tsOut = join(process.cwd(), 'public', 'tesseract');
mkdirSync(tsOut, { recursive: true });
cpSync(join(process.cwd(), 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), join(tsOut, 'worker.min.js'));
const core = join(process.cwd(), 'node_modules', 'tesseract.js-core');
for (const f of readdirSync(core)) if (/^tesseract-core.*\.(wasm|js)$/.test(f)) cpSync(join(core, f), join(tsOut, f));
// libarchive.js's worker and WebAssembly for opening RAR and 7z (src/lib/archive.ts), served from /libarchive
const laOut = join(process.cwd(), 'public', 'libarchive');
mkdirSync(laOut, { recursive: true });
for (const f of ['worker-bundle.js', 'libarchive.wasm']) cpSync(join(process.cwd(), 'node_modules', 'libarchive.js', 'dist', f), join(laOut, f));
console.log('pdf.js, MediaPipe, ONNX Runtime, ZXing, Tesseract and libarchive files copied to public/');
