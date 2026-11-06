import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { dayStamp } from '@/lib/format';
import { decodeImage, encodeImage } from '@/lib/image';
import { savePdf, stepper } from '@/lib/pdf';
import { capLongest } from '../image/sizes';
import { imagePlacement, type Margin, type Orientation, type PageSize } from '../pdfOps';
import type { ToolHandler } from '../types';

/** Long side after re-encoding: A4 at 300 dpi. */
const MAX_SIDE = 2480;

// design/FlowImagesToPdf.dc.html. Every photo is re-encoded to JPEG first (EXIF rotation applied, big photos scaled
// down, PNG / WEBP made embeddable), like the app.
export const imagesToPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const doc = await PDFDocument.create();
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Adding photo {value} of {length}', { value: i + 1, length: files.length }));
    const bmp = await decodeImage(files[i]);
    const jpg = await encodeImage(bmp, capLongest({ w: bmp.width, h: bmp.height }, MAX_SIDE), 'JPEG', 85);
    bmp.close();
    const image = await doc.embedJpg(await jpg.arrayBuffer());
    const p = imagePlacement(image.width, image.height, options.pageSize as PageSize, options.orientation as Orientation, options.margin as Margin);
    const page = doc.addPage([p.pageW, p.pageH]);
    page.drawImage(image, { x: p.x, y: p.y, width: p.w, height: p.h });
  }
  await step(files.length, files.length, t('Saving'));
  const saved = await savePdf(doc, `images-${dayStamp()}.pdf`);
  return { title: t('Your PDF is ready'), files: [saved] };
};
