import { t } from '@/i18n';
import { decodeImage } from '@/lib/image';
import { eraseObjects, type EraseStroke } from '@/lib/inpaint';
import { stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { capLongest, formatOf, outName } from '../image/sizes';
import { ToolError, type ToolHandler } from '../types';

/** The photo is worked on at most this big (the app uploads at most 4096 too). */
const MAX_SIDE = 4096;

// design/FlowObjectEraser.dc.html, in the browser (the app sends it to the server): the painted strokes
// (components/flow/custom/EraserEditor) filled by LaMa (src/lib/inpaint.ts).
export const objectEraser: ToolHandler = async (ctx) => {
  const strokes = (ctx.options.strokes as EraseStroke[] | undefined) ?? [];
  if (!strokes.length) throw new ToolError(t('Paint over the object you want gone first.'));
  const step = stepper(ctx);
  const f = ctx.files[0];
  await step(0, 1, t('Preparing the photo'));
  const bmp = await decodeImage(f);
  const s = capLongest({ w: bmp.width, h: bmp.height }, MAX_SIDE);
  const photo = document.createElement('canvas');
  photo.width = s.w;
  photo.height = s.h;
  photo.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
  bmp.close();
  const out = await eraseObjects(
    photo,
    strokes,
    (done, total) => step(done, total, t('Erasing object')),
    (pct) => ctx.onProgress(0, 1, `${t('Getting the eraser ready (one time only)…')} ${pct}%`),
  );
  photo.width = photo.height = 0;
  const format = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
  const blob = await canvasBlob(out, format === 'PNG' ? 'image/png' : 'image/jpeg', 0.93);
  out.width = out.height = 0;
  return { title: t('Object removed'), files: [{ name: outName(f.name, '-erased', format), blob }] };
};
