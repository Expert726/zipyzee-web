# ZipyZee web: plan

Goal: the app's tools on the web, same copy, Urdu and lime look, files processed in the browser. Started 2026-11-06.

## W1. Base (done)

- Next.js 16 project next to the app (`../zipyzee-web`), Tailwind 4, lucide-react, pdf-lib, vitest.
- `/en` and `/ur` routes (RTL), proxy picks the language (cookie, then browser), language switch keeps the page.
- Lime tokens light + dark (follows the system, switch saved), Poppins + Noto Naskh.
- Registry (all 70 tools, same copy), Home (popular tools per category), All tools (search, sections), tool pages
  (one static page per tool and language, title + description for search), sitemap + robots.
- Generic flow: pick (button or drop) → files + options → progress with Cancel → result with downloads → error.
- 8 tools on the web: Merge PDF, Split PDF, Rotate PDF (all or ranges), Page numbers, Images to PDF,
  Compress image (quality or target size), Resize image, Convert image. The rest show "Coming to the web soon"
  with the Play link.

## W2. More browser tools (in progress)

Done (2026-11-06): PDF Watermark (text or logo, colour, bold, opacity, size, angle, 8 positions, pages), Image
watermark (text or logo, Corner / Center / Tiled), Remove metadata (JPG / PNG stripped without re-encoding, the
orientation kept; others re-encoded), Calculator (Basic / Scientific, typing from the keyboard, history in this
browser), Age calculator (next birthday, totals, Hijri, zodiac, Copy / Share). Option fields gained `color` and
`image`; tools with their own screen go in src/components/custom (CUSTOM_IDS in handlers/ids.ts).
Text editor (2026-11-07): My documents (rename / duplicate / delete), a rich editor (contenteditable) with B I U S,
headings, bullets, numbers, tick boxes, alignment, text colour, highlight, indent, link, picture, line and the page's
font / size / alignment; Urdu and English per paragraph; documents in this browser (IndexedDB, src/textdocs/store.ts),
the open one in the URL (?doc=). Preview and Save PDF (the browser's print dialog, real text, the site's fonts).
Not yet: Save as image.
Make with Zee (2026-11-07): the app's model, prompts, parser, Paper B and print layout copied (src/makedocs, its 14
tests pass). Start: "Make something new" (kind, request, my notes, language; papers: class, difficulty, layout) beside
the last 24 hours' documents (IndexedDB "zeedocs", deleted 24 h after the last change). Editor: every block edited in
place, Redo with AI, Add 3 more like this, Ask Zee to add, move / duplicate / delete, undo / redo, print panel (answer
key, Paper A / B, MCQ columns, lines, page and text size, currency), Preview, Save PDF, CSV for Excel. Gemini through
Firebase AI Logic (src/lib/firebase.ts) with App Check; without the web config it says Zee isn't set up and Start blank
still works. Not yet on the web: making it from a PDF or a photo (needs text reading in the browser), Save image.
Compress PDF (2026-11-07): in the browser (src/tools/pdfShrink.ts). Lossless: extras removed, identical streams kept
once, unpacked streams packed, unused objects dropped. Quality reduction: also the photos (JPEG, and 8-bit RGB / grey
Flate images with PNG predictors) re-encoded at the app's slider sizes (src/tools/pdfCompress.ts, copied). The original
is kept when the saving is under 3 %. Not yet: "Turn pages into images" and the before / after preview (need PDF page
rendering, pdfjs-dist).
PDF to JPG (2026-11-07): pdf.js (pdfjs-dist, its worker / cmaps / fonts copied to public/pdfjs by
scripts/copy-pdfjs.mjs before dev and build) draws each page at the app's 150 / 300 dpi as JPG or PNG; all pages or
page ranges. Several results now download as one ZIP (src/lib/zip.ts). Buttons fill {pages} / {photos} / {images}
like the app (src/tools/verb.ts). pdf.js also unlocks page thumbnails, Compress's "Turn pages into images",
Grayscale and Organize next.
2026-11-07, more PDF tools: Organize PDF (custom editor: thumbnails, drag to move, select, rotate, duplicate,
delete, blank page, add photo; the app's organize.ts / applyOrganize), Remove watermark (the app's
src/tools/watermark finder + live Before | After), Crop PDF (white margins found on the page drawn by pdf.js,
src/tools/contentBounds.ts; the app's cropToBounds), Annotate and sign + Sign PDF (one editor: pages drawn by pdf.js
with an SVG layer in page points; pen, highlight, text, note, signature, eraser, select / move / resize / rotate,
add to every page, undo; signature pad draw / type / photo, saved in this browser; the app's annotate model and
flatten). Tool editors live in components/flow/custom (CUSTOM_SETUPS).
PDF forms (fields filled where they are on the page + a list; lock = flatten; Urdu left to the viewer, the app's
forms.ts), Protect PDF (AES-256) and Unlock PDF via @cantoo/pdf-lib (a maintained pdf-lib fork with encryption,
imported only by those two handlers). Password fields have a show / hide eye.
Compare PDF (words + boxes from pdf.js, src/lib/pageWords.ts; the app's compare.ts diff; custom result screen with
side-by-side highlights, Show filter and the app's report; CUSTOM_RESULTS in components/flow/custom) and Extract
images (pdf-lib reads each picture; Original keeps JPEGs byte for byte, PNG / JPG convert, masks applied).
Redact PDF (editor: drag boxes, click words, Find and mark with phones / emails, undo; marked pages redrawn with
the black painted INTO the picture's pixels; the app draws its boxes on top of the picture, so the hidden text is
still in the image underneath: fix it there too) and Grayscale PDF (pages drawn by pdf.js, turned gray).
Background remover + Change background: ormbg (Apache-2.0; BiRefNet lite until 2026-11-07, see below) via @huggingface/transformers (Apache-2.0), WebAssembly
(first BiRefNet, chosen by the user over a people-only model): ~44 MB downloaded from Hugging Face on first use and
cached by the browser (photos never leave the page); editor with the app's swatches, custom colour, own photo, blur,
Fix edges (erase / restore brush, undo, reset), Before / After (components/flow/custom/BgEditor, src/lib/segment.ts).
Repair PDF (a server tool in the app; in the browser: pdf-lib rebuilds the cross-reference table and copies every
page it can into a clean file, else pdf.js draws the pages it can open as pictures). Server tools in WEB_TOOLS
aren't "coming soon" on the web (registry.ts).
Not tested yet (the user asked to implement first, test at the end): Redact PDF, Grayscale PDF, Background remover,
Change background, Repair PDF, Crop and rotate, Passport photo (MediaPipe face box vs ML Kit's: check the head
size HEAD_PER_FACE still fits), Upscale image (Swin2SR 2x lightweight / 4x real-world via transformers.js, tiles;
no Fix faces), Blur faces (MediaPipe on the photo + 3 x 3 parts for small faces; canvas shrink-blur / pixelate / black), Draw on photo (canvas ink layer;
text in the page's Poppins / Naskh), Collage maker (drag a photo onto another to swap), Batch edit
(a resize / compress / convert re-encode always drops metadata in the browser), Sticker maker (ormbg cut-out,
ring-offset white outline, WebP; PNG where the browser can't write WebP), Signature maker
(Sign PDF's pad in the page; no file to pick), Object eraser (LaMa 208 MB via
onnxruntime-web from /ort, Cache Storage; regions around each object, soft paste; wasm only: WebGPU fails on the FFT blocks) (check the model loads under Turbopack, WebGPU fallback, and the mask lines up).
PDF to PDF/A stays a server tool: real PDF/A (embedded fonts, output intent, no transparency) can't be made honestly
in the browser; it comes with the conversion server (W4).
Next: a live preview for the watermark tools, then the list below.

### Zee on the web: setup (once, in the Firebase console, project zipyzee-e92f1)

1. Project settings → Your apps → Add app → Web. Name it "ZipyZee web". Copy apiKey and appId into .env.local
   (see .env.example).
2. App Check → Apps → the web app → reCAPTCHA Enterprise: create a key for the site's domains (localhost for
   development, the real domain later) and put it in NEXT_PUBLIC_RECAPTCHA_SITE_KEY.
3. Development: run `npm run dev`, open Make with Zee, copy the App Check debug token printed in the browser console
   into App Check → Manage debug tokens (or set NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN).
4. AI Logic is already on for the app (Gemini Developer API); nothing to change there. Restart `npm run dev`.


Done in the browser with libraries the app already uses:
- PDF: Organize (page thumbnails need `pdfjs-dist` for rendering), Crop, Watermark, Remove watermark (copy
  `tools/watermark/`), Grayscale, Protect / Unlock (pdf-lib can't encrypt: needs a WASM qpdf or the server),
  Extract images, PDF to JPG (pdfjs), PDF to text (pdfjs), Compare PDF (copy `tools/compare.ts`), Redact.
- Image: Crop and rotate, Remove metadata (canvas re-encode drops EXIF), Image watermark, Collage, Draw on photo,
  Passport photo (copy `tools/image/`).
- Convert: Excel tools (SheetJS from cdn.sheetjs.com, copy `tools/sheets/`), Make a ZIP / Extract ZIP (fflate or
  zip.js; RAR / 7z need WASM).
- Everyday: Calculator (copy `tools/calc.ts`), Age calculator (`tools/age.ts`), Text editor.
- Scan: QR create (copy `tools/qr.ts`, `qrLinks.ts`), QR scan from a photo or the webcam.

## W3. Shared parts

- Page thumbnails (pdfjs-dist worker) for Split / Organize / Rotate per page, like the app's PageGrid.
- File reordering by drag (keyboard buttons exist now).
- A "Files" page of this visit's results (IndexedDB, cleared after 24 h).

## W4. Server and AI tools

- Word / PowerPoint / PDF to Word, Repair, PDF/A, Searchable PDF, Urdu OCR: call the conversion server
  (`../ZipyZee/server`) when it's live (SERVER_TOOLS_LIVE in `src/tools/registry.ts`). Needs CORS on the server and
  upload consent copy (files leave the computer: update privacy pages).
- Background remover / Change background: an in-browser model (e.g. MediaPipe selfie segmentation) or the server.
- Zee and Make with Zee: Firebase AI Logic for web with App Check (reCAPTCHA Enterprise).

## W5. Accounts and chat

- Firebase web SDK (Google sign-in), the same Firestore rules and data as the app's chat.

## W6. Launch

- Domain (the same one as the privacy / terms pages), `NEXT_PUBLIC_SITE_URL`, hosting (Vercel or Firebase App
  Hosting), Search Console, Open Graph images per tool, privacy page updated for the web, AdSense instead of AdMob.

Speed of the big-model tools (2026-11-07): BiRefNet lite (replaced the same day, see below) takes 1024 x 1024 only; measured on this Mac's CPU
(onnxruntime-node) ~16 s on 1 core (fp16 and fp32 the same), ~6.4 s on 4. So the pages in src/lib/isolated.ts are
cross-origin isolated (next.config.ts headers; COEP credentialless) and reload once when reached by a client-side
link, giving WebAssembly several cores. WebGPU is used only with shader-f16 and falls back to WebAssembly if a run
fails.

Cut-out model switched to ormbg (2026-11-07, user: "remove.bg and the app take 2-3 s"): BiRefNet failed on WebGPU
("Too many storage buffers in shader: 11, max 10") and ran out of WebAssembly memory on several cores (std::bad_alloc).
ormbg (Apache-2.0, ISNet, 8-bit, 44 MB) on the user's parrot photo, onnxruntime-node, 4 cores: 0.7 s vs BiRefNet 10.7 s,
masks nearly the same (mean difference 0.16 / 255). WebAssembly only, no WebGPU. Console: "[segment] ormbg on wasm, …".

Background remover / Change background (2026-11-07, on request, like remove.bg): a photo strip under the editor ("+" adds
several, click to switch, × removes; each photo's cut-out and edge fixes kept while on the page), the last 5 photos kept
in IndexedDB ('recentphotos', src/lib/recentPhotos.ts) for 1 hour and shown as "Recent photos" on the Choose screen;
sparkles over the dimmed photo while the subject is found (FindingSparkles).

Formats, presets, crop, passport (2026-11-07, on request "allow all possible"):
- src/lib/encoders.ts: JPEG / PNG / WEBP (canvas), small PNG (≤256 colours, gifenc quantize + own PNG writer), AVIF
  (@jsquash/avif, WebAssembly), GIF (gifenc), BMP, TIFF (uncompressed), ICO (16-256 px PNGs). Compress: Same / JPG /
  WEBP / AVIF / PNG; Convert: JPG PNG WEBP AVIF GIF BMP TIFF ICO PDF; input also AVIF, GIF, BMP, ICO.
- Resize presets by platform (src/tools/image/presets.ts, option kind 'groups'): Instagram, WhatsApp, Facebook,
  YouTube, TikTok, X, LinkedIn, Pinterest / Snapchat, print and documents, screens.
- Crop and rotate: the dim is four bands over the photo (was a page-wide box-shadow); 15 shapes + Custom W:H.
- Passport photo rebuilt: 25 documents by country + Custom mm (src/tools/image/passportWeb.ts), drag / zoom / reset
  (the face only sets the start; never blocks), Remove background on/off + 6 backgrounds, paper 6×4 / 7×5 / A4 /
  Letter / A5 and 1-16 copies or a full sheet, live sheet preview; files: 300 dpi photo, sheet JPG, sheet PDF.
  Not tested: AVIF under Turbopack, TIFF / ICO / BMP opening in other apps, country sizes against current rules.
