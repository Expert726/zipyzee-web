import { PDFName, PDFNumber, PDFRawStream, PDFRef, type PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, stepper } from '@/lib/pdf';
import { channels, decodeImage, inflate } from '../pdfShrink';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

const N = PDFName.of;
/** "Skip tiny images": icons and logos under 10 KB. */
const TINY = 10 * 1024;

type Found = { ref: PDFRef; s: PDFRawStream };

/** Every picture in the PDF once (by object), not the see-through masks that belong to another picture. */
function findImages(doc: PDFDocument): Found[] {
  const all = doc.context.enumerateIndirectObjects().filter((e): e is [PDFRef, PDFRawStream] => e[1] instanceof PDFRawStream && e[1].dict.get(N('Subtype')) === N('Image'));
  const masks = new Set(all.map(([, s]) => s.dict.get(N('SMask'))).filter((r): r is PDFRef => r instanceof PDFRef).map((r) => r.toString()));
  return all.filter(([ref, s]) => !masks.has(ref.toString()) && !s.dict.get(N('ImageMask'))).map(([ref, s]) => ({ ref, s }));
}

const isJpeg = (s: PDFRawStream) => {
  const f = s.dict.get(N('Filter'));
  return f === N('DCTDecode') || (f && 'asArray' in f && (f as unknown as { asArray(): unknown[] }).asArray().length === 1 && (f as unknown as { asArray(): unknown[] }).asArray()[0] === N('DCTDecode'));
};

/** The picture with its see-through mask (8-bit grey, same size) applied, ready to encode. */
async function draw(doc: PDFDocument, s: PDFRawStream): Promise<HTMLCanvasElement | null> {
  const w = (s.dict.get(N('Width')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const h = (s.dict.get(N('Height')) as PDFNumber | undefined)?.asNumber() ?? 0;
  const colors = channels(doc, s.dict.get(N('ColorSpace')));
  let bmp: ImageBitmap | null = null;
  if (isJpeg(s)) bmp = await createImageBitmap(new Blob([s.contents as BlobPart], { type: 'image/jpeg' }));
  else if (colors && (s.dict.get(N('BitsPerComponent')) as PDFNumber | undefined)?.asNumber() === 8) bmp = await decodeImage(doc, s, w, h, colors);
  if (!bmp) return null;
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0);
  bmp.close();
  const maskRef = s.dict.get(N('SMask'));
  const mask = maskRef ? doc.context.lookup(maskRef) : null;
  if (mask instanceof PDFRawStream && mask.dict.get(N('Filter')) === N('FlateDecode')) {
    const mw = (mask.dict.get(N('Width')) as PDFNumber | undefined)?.asNumber();
    const mh = (mask.dict.get(N('Height')) as PDFNumber | undefined)?.asNumber();
    if (mw === c.width && mh === c.height && !mask.dict.has(N('DecodeParms'))) {
      const alpha = await inflate(mask.contents);
      const px = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < c.width * c.height && i < alpha.length; i++) px.data[i * 4 + 3] = alpha[i];
      g.putImageData(px, 0, 0);
    }
  }
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string) => new Promise<Blob | null>((r) => c.toBlob(r, type, 0.92));

// design/FlowExtractImages.dc.html (the app's handlers/extractImages.ts, PdfBox there): every picture in the PDF,
// read straight out of the file with pdf-lib. "Original" keeps JPEG photos byte for byte and saves the others as PNG;
// JPG / PNG convert all of them. Pictures the browser can't read (CMYK or indexed colours...) are counted, not saved.
export const extractImages: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const stem = fileStem(file.name);
  const format = String(options.format ?? 'original');
  const skipTiny = options.skipTiny !== false;

  await step(0, 1, t('Finding images'));
  const doc = await loadPdf(file);
  const images = findImages(doc).filter((x) => !skipTiny || x.s.contents.length >= TINY);
  if (!images.length) {
    throw new ToolError(`${t('No images found in this PDF.')}${skipTiny ? ` ${t('Turn off Skip tiny images to include small ones.')}` : ''}`);
  }

  const out: OutputFile[] = [];
  let unreadable = 0;
  for (let i = 0; i < images.length; i++) {
    await step(i, images.length, t('Image {min} of {total}', { min: i + 1, total: images.length }));
    const { s } = images[i];
    const n = out.length + 1;
    try {
      if (format === 'original' && isJpeg(s) && !s.dict.get(N('SMask'))) {
        out.push({ name: `${stem}-image-${n}.jpg`, blob: new Blob([s.contents as BlobPart], { type: 'image/jpeg' }) });
        continue;
      }
      const c = await draw(doc, s);
      if (!c) {
        unreadable++;
        continue;
      }
      const jpg = format === 'jpg';
      if (jpg) {
        // JPG has no see-through areas: on white
        const w = document.createElement('canvas');
        w.width = c.width;
        w.height = c.height;
        const g = w.getContext('2d')!;
        g.fillStyle = '#FFFFFF';
        g.fillRect(0, 0, w.width, w.height);
        g.drawImage(c, 0, 0);
        const blob = await toBlob(w, 'image/jpeg');
        if (blob) out.push({ name: `${stem}-image-${n}.jpg`, blob });
      } else {
        const blob = await toBlob(c, 'image/png');
        if (blob) out.push({ name: `${stem}-image-${n}.png`, blob });
      }
    } catch {
      unreadable++;
    }
  }
  if (!out.length) throw new ToolError(t('The images in this PDF are in a format the browser can\'t read. Try the ZipyZee Android app.'));

  const n = out.length;
  const label = `${n} ${n === 1 ? t('image') : t('images')}`;
  return {
    title: t('{label} saved', { label }),
    subtitle: unreadable ? t('{count} could not be read and were left out.', { count: unreadable }) : undefined,
    files: out,
    zipName: `${stem}-images.zip`,
  };
};
