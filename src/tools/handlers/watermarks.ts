// PDF watermark (pdf-lib, the app's drawWatermark) and Image watermark (canvas, the app's placement maths).
import { StandardFonts } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { decodeImage, encodeImage } from '@/lib/image';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { drawImageWatermark, readImageWm } from '@/lib/watermarkImage';
import { capLongest, formatOf, MIME, outName, type ImageFormat } from '../image/sizes';
import { drawWatermark, type WmMark } from '../pdfOps';
import { specOf, watermarkPages } from '../pdfWatermark';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

/** Long side of a logo: sharp on a full page, small in the file. */
const LOGO_SIDE = 1200;

// design/FlowPdfWatermark.dc.html. Helvetica here (the app embeds Plus Jakarta; same Latin-only text).
export const pdfWatermark: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const spec = specOf({ ...options, logo: '', pages: options.which === 'ranges' ? String(options.pages ?? '') : '' });
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);
  const chosen = watermarkPages(spec.pages, doc.getPageCount());
  if (!chosen.ok) throw new ToolError(chosen.error);

  let mark: WmMark;
  if (spec.kind === 'logo') {
    const logo = options.logo;
    if (!(logo instanceof File)) throw new ToolError(t('Choose a logo'));
    try {
      // PNG keeps a logo's see-through background; big images are scaled down
      const bmp = await createImageBitmap(logo);
      const png = await encodeImage(bmp, capLongest({ w: bmp.width, h: bmp.height }, LOGO_SIDE), 'PNG');
      bmp.close();
      mark = { kind: 'logo', image: await doc.embedPng(await png.arrayBuffer()) };
    } catch {
      throw new ToolError(t('The logo could not be read. Try another image.'));
    }
  } else {
    if (!spec.text.trim()) throw new ToolError(t('Enter the watermark text'));
    mark = { kind: 'text', font: await doc.embedFont(spec.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica) };
  }

  const pages = doc.getPages();
  for (let i = 0; i < chosen.pages.length; i++) {
    await step(i, chosen.pages.length, t('Page {value} of {length}', { value: i + 1, length: chosen.pages.length }));
    try {
      drawWatermark(pages[chosen.pages[i]], spec, mark);
    } catch {
      throw new ToolError(t('Use English letters, numbers and common signs in your format.'));
    }
  }
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-watermarked.pdf`);
  return { title: t('Watermark added'), files: [saved] };
};

// design/FlowImageWatermark.dc.html: white text with a soft shadow, or a faded logo; Corner / Center / Tiled.
export const imageWatermark: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  let logo: ImageBitmap | null = null;
  if (options.type === 'logo') {
    if (!(options.logo instanceof File)) throw new ToolError(t('Choose a logo'));
    try {
      logo = await createImageBitmap(options.logo);
    } catch {
      throw new ToolError(t('The logo could not be read. Try another image.'));
    }
  } else if (!String(options.text ?? '').trim()) {
    throw new ToolError(t('Type the watermark text first.'));
  }
  const wm = readImageWm(options, logo);

  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const photo = await decodeImage(f);
    const w = photo.width;
    const h = photo.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d')!;
    g.drawImage(photo, 0, 0);
    photo.close();
    // the same drawing as the live preview (src/lib/watermarkImage.ts)
    drawImageWatermark(g, w, h, wm);
    const format: ImageFormat = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, MIME[format], 0.92));
    if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
    out.push({ name: outName(f.name, '-wm', format), blob });
  }
  logo?.close();
  const n = files.length;
  return { title: n === 1 ? t('Watermark added') : t('Watermark added to {n} photos', { n }), files: out };
};

/** Runs draw() turned `angle` degrees around the center of the box at (x, y). */
