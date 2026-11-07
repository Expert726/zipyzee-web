import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { cleanPage, scanWatermarks, type FoundKind } from '../watermark/pdf';
import { ToolError, type ToolHandler } from '../types';

/** "12 pages cleaned" */
export const cleanedLabel = (n: number) => (n === 1 ? t('1 page cleaned') : t('{count} pages cleaned', { count: n }));

// Remove watermark (the app's handlers/removeWatermark.ts): the editor (components/flow/custom/RemoveWatermarkEditor)
// gives the kinds to take off (layer, overlay, stamp, notes); src/tools/watermark/ (the app's, copied) finds them on
// each page and cuts them out. The rest of the page stays as it was, text still selectable.
export const removeWatermark: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const kinds = (options.kinds as FoundKind[] | undefined) ?? [];
  if (!kinds.length) throw new ToolError(t('Choose what to remove first.'));
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);
  const scan = scanWatermarks(doc);
  const pages = doc.getPages();
  let cleaned = 0;
  for (let i = 0; i < pages.length; i++) {
    await step(i, pages.length, t('Page {n} of {count}', { n: i + 1, count: pages.length }));
    if (cleanPage(pages[i], scan.pages[i], kinds)) cleaned++;
  }
  if (!cleaned) throw new ToolError(t('No separate watermark found. If it\'s part of a scanned page, it can\'t be removed.'));
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-no-watermark.pdf`);
  return { title: t('Watermark removed'), subtitle: cleanedLabel(cleaned), files: [saved] };
};
