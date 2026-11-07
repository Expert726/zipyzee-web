import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import type { ToolHandler } from '../types';

// Grayscale PDF (the app's handlers/grayscalePdf.ts): each page is drawn by pdf.js, turned gray (luminance) and put
// back in a new PDF at the page's own size. Saves printer ink; pages become pictures (said on the options step).
export const grayscalePdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const dpi = options.quality === 'high' ? 200 : 150;
  const view = await openPdf(file);
  try {
    const doc = await PDFDocument.create();
    const count = view.numPages;
    for (let i = 0; i < count; i++) {
      await step(i, count, t('Page {n} of {count}', { n: i + 1, count }));
      const c = await renderPage(view, i, dpi);
      const g = c.getContext('2d')!;
      const img = g.getImageData(0, 0, c.width, c.height);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) d[p] = d[p + 1] = d[p + 2] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
      g.putImageData(img, 0, 0);
      const jpg = await canvasBlob(c, 'image/jpeg', 0.85);
      const vp = (await view.getPage(i + 1)).getViewport({ scale: 1 });
      c.width = c.height = 0;
      doc.addPage([vp.width, vp.height]).drawImage(await doc.embedJpg(await jpg.arrayBuffer()), { x: 0, y: 0, width: vp.width, height: vp.height });
    }
    const saved = await savePdf(doc, `${fileStem(file.name)}-grayscale.pdf`);
    return { title: t('Your PDF is grayscale'), subtitle: t('Ready to print in black and white'), files: [saved] };
  } finally {
    void view.destroy();
  }
};
