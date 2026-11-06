import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { splitGroups, splitName, type SplitMode } from '../pdfOps';
import type { ToolHandler } from '../types';

// design/FlowSplitPdf.dc.html
export const splitPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const src = await loadPdf(files[0]);
  const groups = splitGroups(options.mode as SplitMode, String(options.ranges), Number(options.n), src.getPageCount());
  const stem = fileStem(files[0].name);
  const saved = [];
  for (let i = 0; i < groups.length; i++) {
    await step(i, groups.length, t('Creating file {value} of {length}', { value: i + 1, length: groups.length }));
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, groups[i]);
    pages.forEach((p) => out.addPage(p));
    saved.push(await savePdf(out, splitName(stem, groups[i])));
  }
  return { title: t('Split into {length} {value}', { length: saved.length, value: saved.length === 1 ? t('file') : t('files') }), files: saved };
};
