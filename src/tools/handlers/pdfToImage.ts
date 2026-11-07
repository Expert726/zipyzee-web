import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { stepper } from '@/lib/pdf';
import { parseRanges } from '../ranges';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

const DPI = { normal: 150, high: 300 } as const;
const JPEG_QUALITY = 0.9;

// design/FlowPdfToImage.dc.html: each page (or the chosen ones) as JPG or PNG, drawn by pdf.js at 150 or 300 dpi
// (the app's sizes). Several images: one ZIP with "Download all".
export const pdfToImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const stem = fileStem(file.name);
  const png = options.format === 'png';
  const dpi = DPI[options.quality === 'high' ? 'high' : 'normal'];

  await step(0, 1, t('Reading the PDF'));
  const doc = await openPdf(file);
  try {
    const count = doc.numPages;
    let pages = Array.from({ length: count }, (_, i) => i);
    if (options.pages === 'choose') {
      const r = parseRanges(String(options.ranges ?? ''), count);
      if (!r.ok) throw new ToolError(r.error);
      pages = [...new Set(r.ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i)))].sort((a, b) => a - b);
    }
    const out: OutputFile[] = [];
    for (let i = 0; i < pages.length; i++) {
      await step(i, pages.length, t('Page {value} of {length}', { value: i + 1, length: pages.length }));
      try {
        const canvas = await renderPage(doc, pages[i], dpi);
        out.push({ name: `${stem}-${pages[i] + 1}.${png ? 'png' : 'jpg'}`, blob: await canvasBlob(canvas, png ? 'image/png' : 'image/jpeg', JPEG_QUALITY) });
        canvas.width = canvas.height = 0; // free the memory now
      } catch (e) {
        if (e instanceof ToolError) throw e;
        throw new ToolError(t('Page {value} could not be converted.', { value: pages[i] + 1 }));
      }
    }
    const n = out.length;
    return { title: t('{n} {value} ready', { n, value: n === 1 ? t('image') : t('images') }), files: out, zipName: `${stem}-images.zip` };
  } finally {
    void doc.destroy();
  }
};
