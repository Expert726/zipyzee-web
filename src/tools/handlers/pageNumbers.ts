import { StandardFonts } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { drawPageNumber, oneOf, pageNumberLabel, type NumberFormat, type NumberPosition } from '../pdfOps';
import { ToolError, type ToolHandler } from '../types';

// design/FlowPageNumbers.dc.html. Helvetica Bold here (the app embeds Plus Jakarta; same Latin-only limit).
export const pageNumbers: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const total = pages.length;
  const format = oneOf<NumberFormat>(options.format, 'pageNOfTotal');
  const position = oneOf<NumberPosition>(options.position, 'bottomCenter');
  for (let i = 0; i < total; i++) {
    await step(i, total, t('Page {value} of {total}', { value: i + 1, total }));
    if (options.skipFirst && i === 0) continue;
    const label = pageNumberLabel(format, i + 1, total, String(options.custom ?? ''));
    try {
      drawPageNumber(pages[i], font, label, position);
    } catch {
      throw new ToolError(t('Use English letters, numbers and common signs in your format.'));
    }
  }
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-numbered.pdf`);
  return { title: t('Page numbers added'), files: [saved] };
};
