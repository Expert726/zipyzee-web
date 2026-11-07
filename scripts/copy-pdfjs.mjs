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
console.log('pdf.js, MediaPipe and ONNX Runtime files copied to public/pdfjs, public/mediapipe and public/ort');
