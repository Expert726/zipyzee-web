import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { pageWords } from '@/lib/pageWords';
import { countBoxes, findRedactions, parseTerms, type Box, type RedactPattern } from '../redact';
import { ToolError, type ToolHandler } from '../types';

/** Pages with something hidden are redrawn at this resolution. */
const DPI = 200;

// design/FlowRedactPdf.dc.html (the app's handlers/redactPdf.ts). The areas come marked on the pages (the editor:
// drawn boxes, clicked words, Find and mark); without them, the words and patterns given are found. Every page with
// something to hide is redrawn as a picture with the black boxes painted INTO its pixels (not drawn on top), so the
// hidden text is really gone: nothing under a box can be uncovered. Pages with nothing to hide are kept as they are.
export const redactPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];

  await step(0, 10, t('Finding text to hide'));
  const view = await openPdf(file);
  try {
    const marked = Array.isArray(options.boxes) ? (options.boxes as Box[][]) : null;
    const words = marked ? null : await pageWords(view);
    const { boxes, count } = marked
      ? { boxes: Array.from({ length: view.numPages }, (_, i) => marked[i] ?? []), count: countBoxes(marked) }
      : findRedactions(words!, parseTerms(String(options.terms ?? '')), (options.patterns as RedactPattern[]) ?? []);
    if (!count) throw new ToolError(marked ? t('Mark something to hide first.') : t('Nothing to hide was found in {name}. Check the words and try again.', { name: file.name }));

    const src = await loadPdf(file);
    const out = await PDFDocument.create();
    const changed = boxes.filter((b) => b.length).length;
    let done = 0;
    for (let i = 0; i < view.numPages; i++) {
      if (!boxes[i]?.length) {
        const [copy] = await out.copyPages(src, [i]);
        out.addPage(copy);
        continue;
      }
      await step(1 + (8 * done++) / changed, 10, t('Removing hidden text'));
      const canvas = await renderPage(view, i, DPI);
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#000000';
      // boxes are 0-1 of the page as shown, top-left: the same frame as the drawn page
      for (const b of boxes[i]) g.fillRect(Math.floor(b.x * canvas.width), Math.floor(b.y * canvas.height), Math.ceil(b.w * canvas.width) + 1, Math.ceil(b.h * canvas.height) + 1);
      const jpg = await canvasBlob(canvas, 'image/jpeg', 0.9);
      canvas.width = canvas.height = 0;
      const vp = (await view.getPage(i + 1)).getViewport({ scale: 1 });
      const page = out.addPage([vp.width, vp.height]);
      page.drawImage(await out.embedJpg(await jpg.arrayBuffer()), { x: 0, y: 0, width: vp.width, height: vp.height });
    }
    await step(9, 10, t('Saving'));
    const saved = await savePdf(out, `${fileStem(file.name)}-redacted.pdf`);
    return {
      title: marked
        ? count === 1 ? t('1 area removed for good') : t('{count} areas removed for good', { count })
        : count === 1 ? t('1 item removed for good') : t('{count} items removed for good', { count }),
      subtitle: t('The text under the black boxes is deleted, not just covered'),
      files: [saved],
    };
  } finally {
    void view.destroy();
  }
};
