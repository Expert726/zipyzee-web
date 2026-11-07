// Compress / Resize / Convert image in the browser (canvas). Titles and names match the app's handlers.
import { t } from '@/i18n';
import { formatBytes } from '@/lib/format';
import { decodeImage } from '@/lib/image';
import { drawTo, encodeCanvas, LOSSY, outFileName, outFormatOf, type OutFormat } from '@/lib/encoders';
import { presetOf } from '../image/presets';
import { stepper } from '@/lib/pdf';
import { fitUnder, resizeTarget, savingPercent, sizeLabel, type ResizeBy, type ResizeOptions, type Size } from '../image/sizes';
import type { OutputFile, ToolContext, ToolHandler, ToolResult } from '../types';
import { imagesToPdf } from './imagesToPdf';

/** Compress's "Same format": BMP, TIFF and icons have nothing to compress, so they become (small) PNGs. */
function compressFormat(f: File, saveAs: string): OutFormat {
  if (saveAs !== 'same') return saveAs as OutFormat;
  const own = outFormatOf(f);
  return own === 'BMP' || own === 'TIFF' || own === 'ICO' ? 'PNG' : own;
}

/** `img` at w x h (`cover`: cut from the centre) in `format`. */
async function encodeAt(img: ImageBitmap, w: number, h: number, format: OutFormat, quality: number, opts: { cover?: boolean; small?: boolean } = {}) {
  let src: { x: number; y: number; w: number; h: number } | undefined;
  if (opts.cover) {
    const k = Math.max(w / img.width, h / img.height);
    src = { x: (img.width - w / k) / 2, y: (img.height - h / k) / 2, w: w / k, h: h / k };
  }
  const c = drawTo(img, w, h, format, src);
  const blob = await encodeCanvas(c, format, quality, opts.small);
  c.width = c.height = 0;
  return blob;
}

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
    const format = compressFormat(f, saveAs);
    const bmp = await decodeImage(f);
    const blob = await encodeAt(bmp, bmp.width, bmp.height, format, quality, { small: true });
    bmp.close();
    const keep = blob.size >= f.size && format === outFormatOf(f);
    out.push({ name: outFileName(f.name, '-small', format), blob: keep ? f : blob });
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

/** "Under 100 KB": as big and clear as it can be under the size. JPG, WEBP and AVIF keep their format; others: JPG. */
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
    const wanted = compressFormat(f, String(options.saveAs ?? 'same'));
    const format: OutFormat = LOSSY.includes(wanted) ? wanted : 'JPEG';
    const bmp = await decodeImage(f);
    const tries = new Map<string, Blob>();
    const fit = await fitUnder(target, async (scale, quality) => {
      const b = await encodeAt(bmp, Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)), format, quality);
      tries.set(`${scale}-${quality}`, b);
      return b.size;
    });
    bmp.close();
    const keep = tries.get(`${fit.scale}-${fit.quality}`)!;
    if (!fit.fits) {
      missed++;
      smallestMiss = Math.max(smallestMiss, keep.size);
    }
    out.push({ name: outFileName(f.name, `-${kb}kb`, format), blob: keep });
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
    // a web preset (src/tools/image/presets.ts): filled exactly, cut from the centre
    const target = o.by === 'preset' ? { ...presetOf(o.preset), mode: 'cover' as const } : resizeTarget(src, o);
    first ??= { from: src, to: target };
    // the photo's own format (BMP / TIFF / icons and HEIC: PNG / JPG)
    const own = outFormatOf(f);
    const format: OutFormat = own === 'BMP' || own === 'TIFF' || own === 'ICO' ? 'PNG' : own;
    const blob = await encodeAt(bmp, target.w, target.h, format, QUALITY, { cover: target.mode === 'cover' });
    bmp.close();
    out.push({ name: outFileName(f.name, `-${target.w}x${target.h}`, format), blob });
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

// design/FlowConvertImage.dc.html: JPG / PNG / WEBP (the board), and on the web also AVIF, GIF, BMP, TIFF and ICO
// (src/lib/encoders.ts); PDF = one page per photo, sized to the photo.
export const convertImage: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const to = String(options.to ?? 'JPEG');
  if (to === 'PDF') {
    const res = await imagesToPdf({ ...ctx, options: { pageSize: 'fit', orientation: 'portrait', margin: 'none' } });
    return { ...res, title: converted(files.length) };
  }
  const format = to as OutFormat;
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const bmp = await decodeImage(files[i]);
    out.push({ name: outFileName(files[i].name, '', format), blob: await encodeAt(bmp, bmp.width, bmp.height, format, Number(options.quality ?? 90)) });
    bmp.close();
  }
  return { title: converted(files.length), files: out };
};
