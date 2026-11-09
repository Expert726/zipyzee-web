import { t } from '@/i18n';
import { dayStamp } from '@/lib/format';
import { decodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { canvasBlob } from '@/lib/pdfjs';
import { COLLAGE_CELL_RADIUS, COLLAGE_PREVIEW, COLLAGE_SIZE, type CollageShape } from '../image/collage';
import { fitSource, layoutRects, type CellFit, type WebLayout } from '../image/collageFit';
import { ToolError, type ToolHandler } from '../types';

// design/FlowCollage.dc.html (the app's handlers/collage.ts): 2048 px on the long side, photos cut to fill their
// cells, white background. One photo is open at a time, so nine big photos never sit in memory together.
export const collage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  if (files.length < 2) throw new ToolError(t('Choose at least 2 photos.'));
  if (files.length > 9) throw new ToolError(t('A collage takes up to 9 photos.'));
  const step = stepper(ctx);
  const { w, h } = COLLAGE_SIZE[(options.shape as CollageShape) ?? 'square'];
  const unit = w / COLLAGE_PREVIEW;
  const cells = layoutRects(files.length, (options.layout as WebLayout) ?? 'grid', w, h, Number(options.spacing ?? 6) * unit);
  const r = COLLAGE_CELL_RADIUS * unit;
  const fits = (Array.isArray(options.fits) ? options.fits : []) as (CellFit | undefined)[];

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length + 1, t('Placing photos'));
    const img = await decodeImage(files[i]);
    const c = cells[i];
    // the person's own framing of this photo (zoom, position), else centred like the app
    const s = fitSource(img.width, img.height, c.w, c.h, fits[i]);
    g.save();
    g.beginPath();
    g.roundRect(c.x, c.y, c.w, c.h, r);
    g.clip();
    g.drawImage(img, s.x, s.y, s.w, s.h, c.x, c.y, c.w, c.h);
    g.restore();
    img.close();
  }
  await step(files.length, files.length + 1, t('Saving collage'));
  const blob = await canvasBlob(out, 'image/jpeg', 0.9);
  out.width = out.height = 0;
  return { title: t('Collage saved'), subtitle: `${w} × ${h}`, files: [{ name: `collage-${dayStamp()}.jpg`, blob }] };
};
