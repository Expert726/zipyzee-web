import { t } from '@/i18n';
import { decodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { upscale, type Scale } from '@/lib/upscale';
import { formatOf, MIME, outName } from '../image/sizes';
import { ToolError, type ToolHandler } from '../types';

// design/FlowUpscaleImage.dc.html, in the browser (src/lib/upscale.ts; the app uses the server). 2x or 4x;
// "Fix faces" isn't on the web yet (it needs a face-restoring model).
export const upscaleImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const f = files[0];
  const scale = (Number(options.scale) === 2 ? 2 : 4) as Scale;
  await step(0, 1, t('Opening the photo…'));
  const bmp = await decodeImage(f);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  bmp.close();
  const out = await upscale(
    c,
    scale,
    (done, total) => step(done, total, t('Sharpening part {n} of {count}', { n: done + 1, count: total })),
    (pct) => ctx.onProgress(0, 1, `${t('Getting the upscaler ready (one time only)…')} ${pct}%`),
  );
  const format = formatOf(f.name, f.type) === 'PNG' ? 'PNG' : 'JPEG';
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, MIME[format], 0.93));
  if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
  return { title: t('Photo upscaled {scale}x', { scale }), subtitle: `${c.width} × ${c.height} → ${out.width} × ${out.height}`, files: [{ name: outName(f.name, `-${scale}x`, format), blob }] };
};
