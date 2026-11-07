import { t } from '@/i18n';
import { decodeImage } from '@/lib/image';
import { drawTurned } from '@/lib/turnImage';
import { stepper } from '@/lib/pdf';
import { formatOf, MIME, outName } from '../image/sizes';
import { FULL_CROP, type Crop, type Rotation } from '../scan';
import { ToolError, type ToolHandler } from '../types';

// design/FlowCropImage.dc.html (the app's handlers/cropImage.ts): turn, flip and crop at full resolution, exactly as
// the editor showed (components/flow/custom/CropImageEditor).
export const cropImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const f = files[0];
  const rotation = ((options.rotation as Rotation) ?? 0) as Rotation;
  const flip = !!options.flip;
  const crop = (options.crop as Crop) ?? FULL_CROP;

  await step(0, 2, t('Applying crop'));
  const img = await decodeImage(f);
  const turned = drawTurned(img, rotation, flip);
  img.close();
  const x = Math.round(crop.x * turned.width);
  const y = Math.round(crop.y * turned.height);
  const w = Math.max(1, Math.round(crop.w * turned.width));
  const h = Math.max(1, Math.round(crop.h * turned.height));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  const format = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
  if (format === 'JPEG') {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, w, h);
  }
  g.drawImage(turned, x, y, w, h, 0, 0, w, h);
  turned.width = turned.height = 0;

  await step(1, 2, t('Saving photo'));
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, MIME[format], 0.92));
  if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
  return { title: t('Photo saved'), subtitle: `${w} × ${h}`, files: [{ name: outName(f.name, '-cropped', format), blob }] };
};
