import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

/** Pages rebuilt as pictures (the last resort) at this resolution. */
const DPI = 150;

// design/FlowRepairPdf.dc.html. The app sends this to the server; in the browser:
//  1. pdf-lib reads the file leniently (a broken or missing cross-reference table is rebuilt from the objects
//     themselves), each page is copied into a new, clean document, and the ones that copy are kept. Text stays text.
//  2. If pdf-lib can't find the pages, pdf.js (even more forgiving) draws every page it can open, and those
//     pictures become the new PDF (said in the result: their text can't be selected).
export const repairPdf: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = `${fileStem(file.name)}-repaired.pdf`;

  await step(0, 3, t('Reading the PDF'));
  let src: PDFDocument | null = null;
  try {
    src = await PDFDocument.load(bytes, { throwOnInvalidObject: false, updateMetadata: false });
  } catch (e) {
    if (/encrypt/i.test(String(e))) throw new ToolError(t('{name} is password protected. Unlock it first.', { name: file.name }));
  }

  // 1. pdf-lib: copy page by page into a clean document
  if (src && src.getPageCount() > 0) {
    const total = src.getPageCount();
    const out = await PDFDocument.create();
    let recovered = 0;
    for (let i = 0; i < total; i++) {
      await step(1 + i / total, 3, t('Page {n} of {count}', { n: i + 1, count: total }));
      try {
        const [p] = await out.copyPages(src, [i]);
        out.addPage(p);
        recovered++;
      } catch {
        // a page beyond saving: left out
      }
    }
    if (recovered) {
      await step(2.8, 3, t('Saving'));
      const saved = await savePdf(out, name);
      return { title: t('Recovered {num} of {num2} pages', { num: recovered, num2: total }), files: [saved] };
    }
  }

  // 2. pdf.js: the pages it can draw, as pictures
  let view;
  try {
    view = await openPdf(file);
  } catch (e) {
    if (e instanceof ToolError && /password/i.test(e.message)) throw e;
    throw new ToolError(t('This PDF is too damaged to recover. Try the original file again, or ask for a new copy.'));
  }
  try {
    const total = view.numPages;
    const out = await PDFDocument.create();
    let recovered = 0;
    for (let i = 0; i < total; i++) {
      await step(1 + i / total, 3, t('Page {n} of {count}', { n: i + 1, count: total }));
      try {
        const c = await renderPage(view, i, DPI);
        const jpg = await canvasBlob(c, 'image/jpeg', 0.88);
        const vp = (await view.getPage(i + 1)).getViewport({ scale: 1 });
        c.width = c.height = 0;
        out.addPage([vp.width, vp.height]).drawImage(await out.embedJpg(await jpg.arrayBuffer()), { x: 0, y: 0, width: vp.width, height: vp.height });
        recovered++;
      } catch {
        // left out
      }
    }
    if (!recovered) throw new ToolError(t('This PDF is too damaged to recover. Try the original file again, or ask for a new copy.'));
    await step(2.8, 3, t('Saving'));
    const saved: OutputFile = await savePdf(out, name);
    return {
      title: t('Recovered {num} of {num2} pages', { num: recovered, num2: total }),
      subtitle: t('The pages were rebuilt as pictures, so their text can\'t be selected.'),
      files: [saved],
    };
  } finally {
    void view.destroy();
  }
};
