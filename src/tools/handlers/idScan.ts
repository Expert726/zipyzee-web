import { PDFDocument, StandardFonts } from 'pdf-lib';
import { t } from '@/i18n';
import { renderScanPage, type ScanPageIn } from '@/lib/docScan';
import { dayStamp } from '@/lib/format';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { drawWatermark } from '../pdfOps';
import { WM_DEFAULTS } from '../pdfWatermark';
import { fitIn, idLayout, type IdSize, type PaperSize } from '../scan';
import { ToolError, type ToolHandler } from '../types';

const ID_WATERMARK = 'Copy for bank use only';

// design/FlowIdScan.dc.html (the app's handlers/idScan.ts): front and back from the editor
// (components/flow/custom/scan/IdScanEditor), each straightened along its corners, placed at the chosen card size on
// one A4 or Letter page; the watermark in your words and colour (the bank line when empty).
export const idScan: ToolHandler = async (ctx) => {
  const { options } = ctx;
  const sides = (options.pages ?? []) as (ScanPageIn | null)[];
  if (!sides[0] || !sides[1]) throw new ToolError(t('Scan both sides of the card first.'));
  const step = stepper(ctx);
  const layout = idLayout((options.paper as PaperSize) ?? 'a4', (options.size as IdSize) ?? 'real');

  const doc = await PDFDocument.create();
  const page = doc.addPage([layout.width, layout.height]);
  const boxes = [layout.front, layout.back];
  for (let i = 0; i < 2; i++) {
    await step(i, 3, t('Placing both sides'));
    // the card is ~3.4 in wide on paper (more when larger): 1200 px is plenty
    const c = renderScanPage(sides[i]!, 'original', 1200);
    const image = await doc.embedJpg(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
    const b = fitIn(boxes[i], c.width, c.height);
    c.width = c.height = 0;
    // layout y runs from the top; PDF y from the bottom
    page.drawImage(image, { x: b.x, y: layout.height - b.y - b.h, width: b.w, height: b.h });
  }
  if (options.watermark) {
    await step(2, 3, t('Adding the watermark'));
    const text = String(options.watermarkText ?? '').trim() || ID_WATERMARK;
    const color = typeof options.watermarkColor === 'string' && options.watermarkColor ? options.watermarkColor : WM_DEFAULTS.color;
    try {
      drawWatermark(page, { ...WM_DEFAULTS, text, color, opacity: 0.3 }, { kind: 'text', font: await doc.embedFont(StandardFonts.HelveticaBold) });
    } catch {
      throw new ToolError(t('Use English letters, numbers and common signs in the watermark.'));
    }
  }
  await step(3, 3, t('Saving your PDF'));
  return { title: t('ID card saved'), files: [await savePdf(doc, `id-card-${dayStamp()}.pdf`)] };
};
