import { t } from '@/i18n';
import { fileStem, formatBytes } from '@/lib/format';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { compressSettings, DEFAULT_QUALITY, noRealGain, savingPercent, type CompressMethod } from '../pdfCompress';
import { losslessPass, shrinkImages } from '../pdfShrink';
import type { ToolHandler } from '../types';

// design/FlowCompressPdf.dc.html, in the browser (src/tools/pdfShrink.ts). Lossless: repeats stored once, extras
// removed, packed (same quality). Quality reduction: the photos too, at the slider's quality and size; text stays
// selectable. If it isn't really smaller, the original is kept. The app's wording (its handlers/compressPdf.ts).
export const compressPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const method = (options.method as CompressMethod) ?? 'quality';
  const settings = compressSettings(method, Number(options.quality ?? DEFAULT_QUALITY), false);

  await step(0, 1, t('Finding images'));
  const doc = await loadPdf(file);
  if (settings.mode === 'images') {
    await shrinkImages(doc, settings.maxSide, settings.quality, (done, total) =>
      step(done * 0.8, total || 1, t('Image {min} of {total}', { min: Math.min(done + 1, total), total })),
    );
  }
  await step(0.85, 1, t('Removing repeats'));
  await losslessPass(doc);
  await step(0.95, 1, t('Saving'));
  const out = await savePdf(doc, `${fileStem(file.name)}-compressed.pdf`);

  const before = file.size;
  const after = out.blob.size;
  const smaller = !noRealGain(before, after);
  const saving = smaller ? savingPercent(before, after) : 0;
  if (saving > 0) {
    return { title: t('Your PDF is {saving}% smaller', { saving }), subtitle: t('{bytes} to {bytes2}', { bytes: formatBytes(before), bytes2: formatBytes(after) }), files: [out] };
  }
  // no gain (text only, or already compressed): the original bytes
  return {
    title: t('Your PDF is already small'),
    subtitle:
      settings.mode === 'lossless'
        ? t('It can\'t get smaller without losing quality, so it was kept as it was. Try Quality reduction.')
        : t('It has no big photos to make smaller, so it was kept as it was.'),
    files: [{ name: out.name, blob: file }],
  };
};
