import { t } from '@/i18n';
import { renderHidden } from '@/lib/blurImage';
import { decodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import type { Box, HideStroke, HideStyle } from '../image/blur';
import { formatOf, MIME, outName } from '../image/sizes';
import { ToolError, type ToolHandler } from '../types';

// design/FlowBlurImage.dc.html (the app's handlers/blurImage.ts): the same effect as the editor's preview
// (components/flow/custom/BlurEditor), at the photo's full size.
export const blurImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const boxes = (options.boxes as Box[] | undefined) ?? [];
  const strokes = (options.strokes as HideStroke[] | undefined) ?? [];
  if (!boxes.length && !strokes.length) throw new ToolError(t('Choose something to hide first.'));
  const step = stepper(ctx);
  const f = files[0];
  await step(0, 2, t('Saving photo'));
  const bmp = await decodeImage(f);
  const out = renderHidden(bmp, bmp.width, bmp.height, boxes, (options.style as HideStyle) ?? 'blur', Number(options.strength ?? 3), strokes);
  bmp.close();
  await step(1, 2, t('Saving photo'));
  const format = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
  const blob = await canvasBlob(out, MIME[format] as 'image/jpeg' | 'image/png', 0.92);
  out.width = out.height = 0;
  return { title: t('Faces hidden'), files: [{ name: outName(f.name, '-blurred', format), blob }] };
};
