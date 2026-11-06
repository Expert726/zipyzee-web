import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { parseRanges } from '../ranges';
import { rotatePage, type RotateDirection } from '../pdfOps';
import { ToolError, type ToolHandler } from '../types';

// design/FlowRotatePdf.dc.html. Web v1: one direction for all pages or for page ranges (the app's per-page editor,
// RotateStep, comes later).
export const rotatePdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);
  const count = doc.getPageCount();
  let pages = doc.getPageIndices();
  if (options.which === 'ranges') {
    const r = parseRanges(String(options.ranges ?? ''), count);
    if (!r.ok) throw new ToolError(r.error);
    pages = [...new Set(r.ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i)))];
  }
  for (let i = 0; i < pages.length; i++) {
    await step(i, pages.length, t('Saving page {value} of {length}', { value: i + 1, length: pages.length }));
    rotatePage(doc.getPage(pages[i]), options.direction as RotateDirection);
  }
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-rotated.pdf`);
  return { title: t('Pages rotated'), subtitle: pages.length === 1 ? t('1 page turned') : t('{count} pages turned', { count: pages.length }), files: [saved] };
};
