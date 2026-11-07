import { StandardFonts } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { flattenItems, itemTexts } from '../annotate/flatten';
import type { Item } from '../annotate/model';
import { ToolError, type ToolHandler } from '../types';

// design/FlowAnnotatePdf.dc.html and design/FlowSignPdf.dc.html (the app's handlers/annotatePdf.ts): the items come
// from the editor (components/flow/custom/annotate) and are drawn into the pages with pdf-lib (the app's flatten.ts).
// Helvetica here (the app embeds Plus Jakarta); like the app, text is Latin letters only.
export const annotatePdf: ToolHandler = async (ctx) => {
  const { tool, files, options } = ctx;
  const items = (options.items ?? []) as Item[];
  if (!items.length) throw new ToolError(t('Add something to the page first.'));
  const sign = tool.id === 'sign-pdf';
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const supported = new Set(font.getCharacterSet());
  const missing = itemTexts(items).some((text) => [...text].some((ch) => ch.codePointAt(0)! > 31 && ch !== '\n' && !supported.has(ch.codePointAt(0)!)));
  if (missing) throw new ToolError(t('Some text uses letters this app can\'t write into a PDF yet. Use Latin letters for notes and text.'));

  const label = sign ? t('Adding your signature') : t('Writing notes and ink');
  await flattenItems(doc, items, font, (i, total) => step(i, total, label));
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-${sign ? 'signed' : 'annotated'}.pdf`);
  return { title: sign ? t('Your PDF is signed') : t('Changes saved'), files: [saved] };
};
