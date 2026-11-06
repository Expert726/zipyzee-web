// Browser image decode / encode (canvas). EXIF rotation is applied by createImageBitmap ('from-image').
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';
import { MIME, type ImageFormat, type ResizeMode, type Size } from '@/tools/image/sizes';

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ToolError(t('{name} could not be read. Try another photo.', { name: file.name }));
  }
}

/** Draws `img` at `size` (contain / cover / stretch) and encodes it. Quality is 10-100. */
export async function encodeImage(img: ImageBitmap, size: Size, format: ImageFormat, quality = 90, mode: ResizeMode = 'stretch'): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ToolError(t('Something went wrong. Try again.'));
  ctx.imageSmoothingQuality = 'high';
  if (format === 'JPEG') {
    // JPEG has no transparency: white like the app
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size.w, size.h);
  }
  if (mode === 'cover') {
    const k = Math.max(size.w / img.width, size.h / img.height);
    const sw = size.w / k;
    const sh = size.h / k;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, size.w, size.h);
  } else {
    ctx.drawImage(img, 0, 0, size.w, size.h);
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, MIME[format], quality / 100));
  if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
  return blob;
}
