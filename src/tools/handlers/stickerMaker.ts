import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { decodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { subjectMask } from '@/lib/segment';
import { alphaBounds, STICKER, STICKER_MAX_BYTES, stickerFit } from '../image/sticker';
import { capLongest } from '../image/sizes';
import { ToolError, type ToolHandler } from '../types';

/** The cut-out is made at most this big before it's fitted into the sticker. */
const WORK_SIDE = 1024;
/** How far the white outline reaches past the subject, in sticker px (the app's Dilate 7). */
const OUTLINE = 7;

// Sticker maker (the app's handlers/stickerMaker.ts): the subject cut out with the same model as Background remover
// (src/lib/segment.ts, in the browser), trimmed to it, fitted into 512 x 512 with a margin, optionally given a white
// outline (the shape drawn white in a ring of offsets behind it), and saved as a WebP under 100 KB, the size WhatsApp
// takes. A browser that can't write WebP (older Safari) gets a PNG.
export const stickerMaker: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  await step(0, 3, t('Finding the subject'));
  const bmp = await decodeImage(file);
  const size = capLongest({ w: bmp.width, h: bmp.height }, WORK_SIDE);
  const cut = document.createElement('canvas');
  cut.width = size.w;
  cut.height = size.h;
  const cg = cut.getContext('2d', { willReadFrequently: true })!;
  cg.drawImage(bmp, 0, 0, size.w, size.h);
  bmp.close();
  const mask = await subjectMask(cut, (pct) => ctx.onProgress(0, 3, `${t('Getting the background tool ready (one time only)…')} ${pct}%`));

  await step(1, 3, t('Cutting it out'));
  const px = cg.getImageData(0, 0, size.w, size.h);
  for (let i = 0; i < mask.length; i++) px.data[i * 4 + 3] = mask[i];
  cg.putImageData(px, 0, 0);
  const b = alphaBounds(new Uint8Array(px.data.buffer), size.w, size.h);
  if (!b) throw new ToolError(t('Couldn\'t find a person or object to cut out. Try a photo with a clear subject.'));
  const src = { x: Math.max(0, b.x - 1), y: Math.max(0, b.y - 1), w: Math.min(size.w, b.w + 2), h: Math.min(size.h, b.h + 2) };
  const dst = stickerFit(src);

  await step(2, 3, t('Making your sticker'));
  const out = document.createElement('canvas');
  out.width = out.height = STICKER;
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  if (options.outline !== false) {
    // the subject's shape in white, drawn around a ring of offsets: a grown silhouette behind it
    const white = document.createElement('canvas');
    white.width = white.height = STICKER;
    const wg = white.getContext('2d')!;
    wg.drawImage(cut, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
    wg.globalCompositeOperation = 'source-in';
    wg.fillStyle = '#FFFFFF';
    wg.fillRect(0, 0, STICKER, STICKER);
    for (let a = 0; a < 24; a++) {
      const r = (a / 24) * Math.PI * 2;
      g.drawImage(white, Math.cos(r) * OUTLINE, Math.sin(r) * OUTLINE);
    }
    g.drawImage(white, 0, 0);
    white.width = white.height = 0;
  }
  g.drawImage(cut, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
  cut.width = cut.height = 0;

  // the best quality that stays under WhatsApp's 100 KB
  const encode = (q: number) => new Promise<Blob | null>((r) => out.toBlob(r, 'image/webp', q / 100));
  let blob: Blob | null = null;
  for (const q of [90, 80, 70, 60, 50, 40, 30]) {
    blob = await encode(q);
    if (!blob || blob.type !== 'image/webp' || blob.size <= STICKER_MAX_BYTES) break;
  }
  if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
  const webp = blob.type === 'image/webp';
  return {
    title: t('Your sticker is ready'),
    subtitle: webp ? t('512 × 512 WebP, the size WhatsApp takes for stickers.') : t('Saved as a 512 × 512 PNG: this browser can\'t make WebP. Chrome, Edge or Firefox can.'),
    files: [{ name: `${fileStem(file.name)}-sticker.${webp ? 'webp' : 'png'}`, blob }],
  };
};
