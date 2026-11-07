import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { renderPassport, renderPlan } from '@/lib/passportImage';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { paperOf, photoPixels, sheetPlan, type Box, type DocSpec } from '../image/passportWeb';
import { ToolError, type ToolHandler } from '../types';

// design/FlowPassportPhoto.dc.html (the app's handlers/passportPhoto.ts), web version: the document chosen in the
// editor (components/flow/custom/PassportEditor, any country or a custom size), the person's own crop, background
// removed or not; one photo at 300 dpi, and the print sheet (any paper, any number of copies) as a JPG and a PDF at
// the paper's real size, ready for any printer or photo shop.
export const passportPhoto: ToolHandler = async (ctx) => {
  const { options } = ctx;
  const spec = options.spec as DocSpec | undefined;
  const crop = options.crop as Box | undefined;
  const photo = options.photo as HTMLCanvasElement | undefined;
  if (!spec || !crop || !photo) throw new ToolError(t('Choose a photo'));
  const paper = paperOf(String(options.paper ?? '4x6'));
  const plan = sheetPlan(spec, paper, Number(options.copies ?? 0));
  if (!plan.boxes.length) throw new ToolError(t('This size doesn\'t fit on this paper. Pick bigger paper.'));
  const step = stepper(ctx);
  const name = `passport-${spec.wMm}x${spec.hMm}mm`;

  await step(0, 3, t('Fixing background and size'));
  const px = photoPixels(spec);
  const single = renderPassport(photo, (options.mask as Uint8ClampedArray | null) ?? null, crop, px.w, px.h, String(options.bg ?? '#FFFFFF'));
  const singleJpg = await canvasBlob(single, 'image/jpeg', 0.95);

  await step(1, 3, t('Making the print sheet'));
  const sheet = renderPlan(single, plan, 300);
  const sheetJpg = await canvasBlob(sheet, 'image/jpeg', 0.95);
  sheet.width = sheet.height = 0;
  const doc = await PDFDocument.create();
  const pt = (mm: number) => (mm / 25.4) * 72;
  doc.addPage([pt(plan.wMm), pt(plan.hMm)]).drawImage(await doc.embedJpg(await sheetJpg.arrayBuffer()), { x: 0, y: 0, width: pt(plan.wMm), height: pt(plan.hMm) });
  const pdf = await savePdf(doc, `${name}-${paper.id}-sheet.pdf`);

  await step(2, 3, t('Saving'));
  return {
    title: t('Passport photo ready'),
    subtitle: t('{count} photos on one {sheet} sheet', { count: plan.boxes.length, sheet: t(paper.label) }),
    files: [{ name: `${name}.jpg`, blob: singleJpg }, { name: `${name}-${paper.id}-sheet.jpg`, blob: sheetJpg }, pdf],
    zipName: `${name}.zip`,
  };
};
