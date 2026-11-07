import { PDFBool, PDFName, StandardFonts } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { fillFields, unsupportedChars, type FormValues } from '../forms';
import { ToolError, type ToolHandler } from '../types';

// design/FlowPdfForms.dc.html (the app's handlers/pdfForms.ts): values come from the forms editor
// (components/flow/custom/FormsEditor). Field appearances are drawn in Helvetica (the app uses Plus Jakarta). Text it
// can't draw (Urdu) is left for the PDF viewer to draw (NeedAppearances), which isn't possible once fields are locked.
export const pdfForms: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const values = (options.fields ?? {}) as FormValues;
  const lock = !!options.lock;
  const step = stepper(ctx);
  const doc = await loadPdf(files[0]);

  const count = Object.values(values).filter((v) => v !== '' && v !== false).length;
  await step(0, 2, t('Filling {count} {fields}', { count, fields: count === 1 ? t('field') : t('fields') }));

  const font = await doc.embedFont(StandardFonts.Helvetica);
  if (unsupportedChars(values, font).length) {
    if (lock) throw new ToolError(t('Some text uses letters this form can\'t show. Use Latin letters, or don\'t lock the fields.'));
    fillFields(doc, values);
    doc.getForm().acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
  } else {
    fillFields(doc, values, { font, flatten: lock });
  }

  await step(1, 2, t('Saving'));
  const saved = await savePdf(doc, `${fileStem(files[0].name)}-filled.pdf`, { updateFieldAppearances: false });
  return { title: t('Form saved'), files: [saved] };
};
