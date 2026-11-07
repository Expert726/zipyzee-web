import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { openPdf, renderPage } from '@/lib/pdfjs';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { contentBounds } from '../contentBounds';
import { cropToBounds } from '../pdfOps';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

/** Pages are looked at this small: plenty to find the margins, quick on long PDFs. */
const LOOK_DPI = 50;

// design/FlowCropPdf.dc.html (the app's handlers/cropPdf.ts): "Remove white margins" on every page, keeping a small
// margin (CROP_MARGIN). The white area is found on the page drawn by pdf.js (src/tools/contentBounds.ts); the crop
// box is set with pdf-lib, so text stays text. Several PDFs: each its own "-cropped" file; one with nothing to trim
// is left out (and said so).
export const cropPdf: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const docs = await Promise.all(files.map((f) => loadPdf(f)));
  const total = docs.reduce((n, d) => n + d.getPageCount(), 0);
  let done = 0;
  const saved: OutputFile[] = [];
  const untouched: string[] = [];

  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    const doc = docs[f];
    const pages = doc.getPages();
    const view = await openPdf(file);
    let changed = 0;
    try {
      for (let i = 0; i < pages.length; i++) {
        await step(
          done++,
          total,
          files.length > 1 ? t('{name}, page {value} of {length}', { name: file.name, value: i + 1, length: pages.length }) : t('Page {value} of {length}', { value: i + 1, length: pages.length }),
        );
        const canvas = await renderPage(view, i, LOOK_DPI);
        const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
        const bounds = contentBounds(px, canvas.width, canvas.height);
        canvas.width = canvas.height = 0;
        if (bounds.length && cropToBounds(pages[i], bounds)) changed++;
      }
    } finally {
      void view.destroy();
    }
    if (changed) saved.push(await savePdf(doc, `${fileStem(file.name)}-cropped.pdf`));
    else untouched.push(file.name);
  }
  if (!saved.length) {
    throw new ToolError(
      files.length > 1 ? t('No white margins to remove in these PDFs. The content already reaches the edges.') : t('No white margins to remove. The content already reaches the edges.'),
    );
  }
  return {
    title: saved.length > 1 ? t('{count} PDFs cropped', { count: saved.length }) : t('Pages cropped'),
    subtitle: untouched.length
      ? untouched.length === 1
        ? t('{name} had no white margins, so it was left out.', { name: untouched[0] })
        : t('{count} PDFs had no white margins, so they were left out.', { count: untouched.length })
      : undefined,
    files: saved,
  };
};
