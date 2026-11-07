import { t } from '@/i18n';
import { dayStamp, formatBytes } from '@/lib/format';
import { decodeImage, encodeImage } from '@/lib/image';
import { stepper } from '@/lib/pdf';
import { capLongest, EXT, formatOf, isWebImage, MIME, outName, type ImageFormat } from '../image/sizes';
import { stripJpeg, stripPng } from '../image/strip';
import type { OutputFile, ToolHandler } from '../types';

/** 'trip-{n}' + 3 -> 'trip-3'; without {n} the number is added: 'trip' -> 'trip-3'. */
export function batchName(pattern: string, n: number) {
  const p = pattern.trim() || 'photo-{n}';
  return p.includes('{n}') ? p.replace(/\{n\}/g, String(n)) : `${p}-${n}`;
}

// design/FlowBatchEdit.dc.html (the app's handlers/batchEdit.ts): the chosen steps in order. Resize (longest side),
// compress (quality) and convert to JPG are one canvas re-encode, which keeps no metadata (in the app it can);
// Remove metadata alone cuts it out of JPG / PNG without re-encoding (src/tools/image/strip.ts); Rename numbers the
// files. "Download all" gives one ZIP, as in the app.
export const batchEdit: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const steps = new Set((options.steps as string[]) ?? []);
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  const used = new Set<string>();
  let before = 0;
  let after = 0;

  for (let i = 0; i < files.length; i++) {
    await step(i, files.length, t('Photo {value} of {length}', { value: i + 1, length: files.length }));
    const f = files[i];
    const original = formatOf(f.name, f.type);
    let format: ImageFormat = steps.has('convert') ? 'JPEG' : original;
    before += f.size;

    let blob: Blob;
    const reencodes = steps.has('resize') || steps.has('compress') || steps.has('convert') || !isWebImage(f.name, f.type);
    const clean = !reencodes && steps.has('strip') ? await stripLossless(f, original) : null;
    if (clean) blob = clean;
    else if (reencodes || steps.has('strip')) {
      const bmp = await decodeImage(f);
      if (!isWebImage(f.name, f.type) && !steps.has('convert')) format = 'JPEG'; // HEIC and the like: JPG
      const size = steps.has('resize') ? capLongest({ w: bmp.width, h: bmp.height }, Number(options.longest) || 1600) : { w: bmp.width, h: bmp.height };
      blob = await encodeImage(bmp, size, format, steps.has('compress') ? Number(options.quality ?? 75) : 92);
      bmp.close();
    } else blob = f;

    let name = steps.has('rename') ? `${batchName(String(options.name ?? ''), i + 1)}.${EXT[format]}` : outName(f.name, '', format);
    // two photos called the same would overwrite each other in the ZIP
    for (let n = 2; used.has(name.toLowerCase()); n++) name = name.replace(/(-\d+)?(\.[^.]+)$/, `-${n}$2`);
    used.add(name.toLowerCase());
    after += blob.size;
    out.push({ name, blob: blob.type === MIME[format] ? blob : new Blob([blob], { type: MIME[format] }) });
  }

  const n = files.length;
  return {
    title: t('{n} {value} done', { n, value: n === 1 ? t('photo') : t('photos') }),
    subtitle: t('{bytes} to {bytes2}', { bytes: formatBytes(before), bytes2: formatBytes(after) }),
    files: out,
    zipName: `batch-${dayStamp()}.zip`,
  };
};

async function stripLossless(f: File, format: ImageFormat): Promise<Blob | null> {
  if (format !== 'JPEG' && format !== 'PNG') return null;
  const bytes = new Uint8Array(await f.arrayBuffer());
  const clean = format === 'PNG' ? stripPng(bytes) : stripJpeg(bytes);
  return clean ? new Blob([clean as BlobPart], { type: MIME[format] }) : null;
}
