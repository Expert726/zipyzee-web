import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { renderScanPage, type ScanPageIn } from '@/lib/docScan';
import { dayStamp } from '@/lib/format';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { SCAN_PAGE_WIDTH, type ScanFilter } from '../scan';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

// design/FlowSmartScan.dc.html (the app's handlers/smartScan.ts): the pages from the editor
// (components/flow/custom/scan/ScanEditor) straightened, turned and filtered (src/lib/docScan.ts), then one PDF with
// pages 595 pt wide (A4 width) whose height follows each page, or one JPG per page.
export const smartScan: ToolHandler = async (ctx) => {
  const { options } = ctx;
  const pages = (options.pages ?? []) as ScanPageIn[];
  if (!pages.length) throw new ToolError(t('Scan at least one page first.'));
  const filter = (options.filter as ScanFilter) ?? 'clean';
  const step = stepper(ctx);
  const stem = `scan-${dayStamp()}`;

  const jpgs: { blob: Blob; w: number; h: number }[] = [];
  for (let i = 0; i < pages.length; i++) {
    await step(i, pages.length, t('Cleaning page {value} of {length}', { value: i + 1, length: pages.length }));
    const c = renderScanPage(pages[i], filter, 2400);
    jpgs.push({ blob: await canvasBlob(c, 'image/jpeg', 0.9), w: c.width, h: c.height });
    c.width = c.height = 0;
  }

  if (options.output === 'images') {
    const files: OutputFile[] = jpgs.map((j, i) => ({ name: pages.length === 1 ? `${stem}.jpg` : `${stem}-${i + 1}.jpg`, blob: j.blob }));
    return { title: t('Scan saved as images'), files, zipName: `${stem}.zip` };
  }
  await step(pages.length, pages.length, t('Saving your PDF'));
  const doc = await PDFDocument.create();
  for (const j of jpgs) {
    const image = await doc.embedJpg(await j.blob.arrayBuffer());
    const h = (SCAN_PAGE_WIDTH * j.h) / j.w;
    doc.addPage([SCAN_PAGE_WIDTH, h]).drawImage(image, { x: 0, y: 0, width: SCAN_PAGE_WIDTH, height: h });
  }
  return { title: t('Scan saved as PDF'), files: [await savePdf(doc, `${stem}.pdf`)] };
};
