import { t } from '@/i18n';
import { decodeImage, encodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { formatOf, MIME, outName } from '../image/sizes';
import { stripJpeg, stripPng } from '../image/strip';
import type { OutputFile, ToolHandler } from '../types';

// design/FlowStripMetadata.dc.html. JPG and PNG: metadata cut out without re-encoding (src/tools/image/strip.ts).
// Other formats (WEBP, HEIC): re-encoded, which keeps no metadata.
export const stripMetadata: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const format = formatOf(f.name, f.type);
    const bytes = new Uint8Array(await f.arrayBuffer());
    const clean = format === 'PNG' ? stripPng(bytes) : format === 'JPEG' ? stripJpeg(bytes) : null;
    if (clean) {
      out.push({ name: outName(f.name, '-clean', format), blob: new Blob([clean as BlobPart], { type: MIME[format] }) });
    } else {
      const bmp = await decodeImage(f);
      const to = format === 'WEBP' ? 'WEBP' : 'JPEG';
      out.push({ name: outName(f.name, '-clean', to), blob: await encodeImage(bmp, { w: bmp.width, h: bmp.height }, to, 95) });
      bmp.close();
    }
  }
  return { title: t('Location and details removed'), subtitle: t('Safe to share'), files: out };
};
