import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { dayStamp } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import type { ToolHandler } from '../types';

// design/FlowMergePdf.dc.html
export const mergePdf: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const merged = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Adding file {value} of {length}', { value: i + 1, length: files.length }));
    const src = await loadPdf(files[i]);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  await step(files.length, files.length, t('Saving'));
  const saved = await savePdf(merged, `merged-${dayStamp()}.pdf`);
  return { title: t('Your PDFs are merged'), subtitle: t('{pageCount} pages in one file', { pageCount: merged.getPageCount() }), files: [saved] };
};
