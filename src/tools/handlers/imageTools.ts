// Compress / Resize / Convert image in the browser (canvas). Titles and names match the app's handlers.
import { t } from '@/i18n';
import { formatBytes } from '@/lib/format';
import { decodeImage, encodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { fitUnder, formatOf, outName, resizeTarget, savingPercent, sizeLabel, type ImageFormat, type ResizeBy, type ResizeOptions, type Size } from '../image/sizes';
import type { OutputFile, ToolContext, ToolHandler, ToolResult } from '../types';
import { imagesToPdf } from './imagesToPdf';

const formatOfFile = (f: File) => formatOf(f.name, f.type);

// design/FlowCompressImage.dc.html. A photo that would come out bigger is kept as it was.
export const compressImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  if (options.target && options.target !== 'any') return compressToTarget(ctx, Number(options.target) * 1024);
  const step = stepper(ctx);
  const quality = Number(options.quality ?? 60);
  const saveAs = String(options.saveAs ?? 'same');
  let before = 0;
  let after = 0;
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const format: ImageFormat = saveAs === 'JPEG' || saveAs === 'WEBP' ? saveAs : formatOfFile(f);
    const bmp = await decodeImage(f);
    const blob = await encodeImage(bmp, { w: bmp.width, h: bmp.height }, format, quality);
    bmp.close();
    const keep = blob.size >= f.size && format === formatOfFile(f);
    out.push({ name: outName(f.name, '-small', format), blob: keep ? f : blob });
    before += f.size;
    after += keep ? f.size : blob.size;
  }
  const saving = savingPercent(before, after);
  const who = files.length > 1 ? t('Photos are') : t('Photo is');
  return {
    title: saving > 0 ? t('{value} {saving}% smaller', { value: who, saving }) : t('{value} already small', { value: who }),
    subtitle: t('{bytes} to {bytes2}', { bytes: formatBytes(before), bytes2: formatBytes(after) }),
    files: out,
  };
};

/** "Under 100 KB": as big and clear as it can be under the size. PNG is saved as JPG; WEBP stays WEBP. */
async function compressToTarget(ctx: ToolContext, target: number): Promise<ToolResult> {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const kb = Math.round(target / 1024);
  let before = 0;
  let after = 0;
  let missed = 0;
  let smallestMiss = 0;
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const format: ImageFormat = options.saveAs === 'WEBP' || (options.saveAs === 'same' && formatOfFile(f) === 'WEBP') ? 'WEBP' : 'JPEG';
    const bmp = await decodeImage(f);
    const tries = new Map<string, Blob>();
    const fit = await fitUnder(target, async (scale, quality) => {
      const b = await encodeImage(bmp, { w: Math.max(1, Math.round(bmp.width * scale)), h: Math.max(1, Math.round(bmp.height * scale)) }, format, quality);
      tries.set(`${scale}-${quality}`, b);
      return b.size;
    });
    bmp.close();
    const keep = tries.get(`${fit.scale}-${fit.quality}`)!;
    if (!fit.fits) {
      missed++;
      smallestMiss = Math.max(smallestMiss, keep.size);
    }
    out.push({ name: outName(f.name, `-${kb}kb`, format), blob: keep });
    before += f.size;
    after += keep.size;
  }
  return {
    title: missed
      ? t('Couldn\'t get under {kb} KB', { kb })
      : files.length > 1 ? t('All photos are under {kb} KB', { kb }) : t('Under {kb} KB ({size})', { kb, size: formatBytes(after) }),
    subtitle: missed
      ? t('The smallest it could get is {size} without losing the picture.', { size: formatBytes(smallestMiss) })
      : t('{bytes} to {bytes2}', { bytes: formatBytes(before), bytes2: formatBytes(after) }),
    files: out,
  };
}

const QUALITY = 92;

function resizeOptions(o: Record<string, unknown>): ResizeOptions {
  return {
    by: (o.by as ResizeBy) ?? 'pixels',
    width: Number(o.width) || 0,
    height: Number(o.height) || 0,
    keep: o.keep !== false,
    percent: Number(o.percent ?? 50),
    preset: String(o.preset ?? '') || 'instagram',
  };
}

// design/FlowResizeImage.dc.html: by pixels (keep proportions = fit inside), percent, or a preset (exact size, cropped
// from the centre).
export const resizeImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const o = resizeOptions(options);
  const out: OutputFile[] = [];
  let first: { from: Size; to: Size } | undefined;
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, files.length > 1 ? t('Photo {value} of {length}', { value: i + 1, length: files.length }) : t('Saving photo'));
    const f = files[i];
    const bmp = await decodeImage(f);
    const src = { w: bmp.width, h: bmp.height };
    const target = resizeTarget(src, o);
    first ??= { from: src, to: target };
    const format: ImageFormat = formatOfFile(f) === 'PNG' ? 'PNG' : 'JPEG';
    const blob = await encodeImage(bmp, target, format, QUALITY, target.mode === 'cover' ? 'cover' : 'stretch');
    bmp.close();
    out.push({ name: outName(f.name, `-${target.w}x${target.h}`, format), blob });
  }
  const n = files.length;
  return {
    title: n === 1 ? t('Photo resized') : t('{n} photos resized', { n }),
    subtitle:
      first && n === 1 ? t('{sizeLabel} to {sizeLabel2}', { sizeLabel: sizeLabel(first.from), sizeLabel2: sizeLabel(first.to) })
        : o.by === 'percent' ? t('{percent}% of the original size', { percent: o.percent })
          : first && `${o.by === 'preset' ? '' : t('Up to ')}${sizeLabel(first.to)}`,
    files: out,
  };
};

const converted = (n: number) => (n === 1 ? t('Photo converted') : t('{n} photos converted', { n }));

// design/FlowConvertImage.dc.html: JPG / PNG / WEBP; PDF = one page per photo, sized to the photo.
export const convertImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const to = String(options.to ?? 'JPEG');
  if (to === 'PDF') {
    const res = await imagesToPdf({ ...ctx, options: { pageSize: 'fit', orientation: 'portrait', margin: 'none' } });
    return { ...res, title: converted(files.length) };
  }
  const format = to as ImageFormat;
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const bmp = await decodeImage(files[i]);
    out.push({ name: outName(files[i].name, '', format), blob: await encodeImage(bmp, { w: bmp.width, h: bmp.height }, format, Number(options.quality ?? 90)) });
    bmp.close();
  }
  return { title: converted(files.length), files: out };
};
