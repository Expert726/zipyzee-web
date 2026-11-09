import { t } from '@/i18n';
import { decodeImage, encodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { formatOf, MIME, outName } from '../image/sizes';
import { stripJpeg, stripPng } from '../image/strip';
import { removeMeta, type MetaGroup } from '../image/metadataWeb';
import type { OutputFile, ToolHandler } from '../types';

// design/FlowStripMetadata.dc.html. JPG and PNG: the chosen details cut out without re-encoding
// (src/tools/image/metadataWeb.ts, strip.ts).
// Other formats (WEBP, HEIC): re-encoded, which keeps no metadata.
export const stripMetadata: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const remove = Array.isArray(options.remove) ? new Set(options.remove as MetaGroup[]) : null;
  const out: OutputFile[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const format = formatOf(f.name, f.type);
    const bytes = new Uint8Array(await f.arrayBuffer());
    // the groups the editor set to Remove (components/flow/custom/MetadataEditor); none given = everything
    const clean = remove ? removeMeta(bytes, remove) : format === 'PNG' ? stripPng(bytes) : format === 'JPEG' ? stripJpeg(bytes) : null;
    if (clean) {
      out.push({ name: outName(f.name, '-clean', format), blob: new Blob([clean as BlobPart], { type: MIME[format] }) });
    } else {
      const bmp = await decodeImage(f);
      const to = format === 'WEBP' ? 'WEBP' : 'JPEG';
      out.push({ name: outName(f.name, '-clean', to), blob: await encodeImage(bmp, { w: bmp.width, h: bmp.height }, to, 95) });
      bmp.close();
    }
  }
  const all = !remove || remove.has('location');
  return { title: all ? t('Location and details removed') : t('Details removed'), subtitle: t('Safe to share'), files: out };
};
