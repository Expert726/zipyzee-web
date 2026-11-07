import { t } from '@/i18n';
import { renderDrawing } from '@/lib/drawImage';
import { decodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { hasDrawing, type DrawItem } from '../image/draw';
import { formatOf, MIME, outName } from '../image/sizes';
import { ToolError, type ToolHandler } from '../types';

// Draw on photo (the app's handlers/drawImage.ts; no board): the editor's drawing (components/flow/custom/DrawEditor)
// at the photo's full size, saved as a new photo.
export const drawImage: ToolHandler = async (ctx) => {
  const items = (ctx.options.items as DrawItem[] | undefined) ?? [];
  if (!hasDrawing(items)) throw new ToolError(t('Draw something first.'));
  const step = stepper(ctx);
  const f = ctx.files[0];
  await step(0, 2, t('Saving photo'));
  const bmp = await decodeImage(f);
  const out = renderDrawing(bmp, bmp.width, bmp.height, items);
  bmp.close();
  await step(1, 2, t('Saving photo'));
  const format = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
  const blob = await canvasBlob(out, MIME[format] as 'image/jpeg' | 'image/png', 0.92);
  out.width = out.height = 0;
  return { title: t('Drawing saved'), files: [{ name: outName(f.name, '-drawn', format), blob }] };
};
