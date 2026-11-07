import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { decodeImage, encodeImage } from '@/lib/image';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { capLongest } from '../image/sizes';
import type { OrganizePage } from '../organize';
import { applyOrganize, pagesLabel } from '../pdfOps';
import { ToolError, type ToolHandler } from '../types';

/** Long side of an added photo: A4 at 300 dpi (as Images to PDF). */
const MAX_SIDE = 2480;

// design/FlowOrganizePdf.dc.html: the pages come from the Organize editor (components/flow/custom/OrganizeEditor);
// added photos come as files (`photos`, by the page's `image` key). The app's handlers/organizePdf.ts.
export const organizePdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const order = (options.pages ?? []) as OrganizePage[];
  const added = (options.photos ?? {}) as Record<string, File>;
  if (!order.length) throw new ToolError(t('Keep at least one page.'));
  const step = stepper(ctx);
  const src = await loadPdf(files[0]);
  // photos: re-encoded to JPEG (EXIF turn applied, PNG / WEBP made embeddable, big ones scaled down)
  const photos: Record<string, string> = {};
  for (const key of new Set(order.map((p) => p.image).filter((k): k is string => !!k))) {
    const f = added[key];
    if (!f) throw new ToolError(t('A photo you added could not be read. Remove it and try again.'));
    try {
      const bmp = await decodeImage(f);
      const jpg = await encodeImage(bmp, capLongest({ w: bmp.width, h: bmp.height }, MAX_SIDE), 'JPEG', 85);
      bmp.close();
      const bytes = new Uint8Array(await jpg.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      photos[key] = btoa(bin);
    } catch {
      throw new ToolError(t('A photo you added could not be read. Remove it and try again.'));
    }
  }
  const writing = t('Writing {pages}', { pages: pagesLabel(order.length) });
  const out = await applyOrganize(src, order, (i, total) => step(i, total, writing), photos);
  const saved = await savePdf(out, `${fileStem(files[0].name)}-organized.pdf`);
  return { title: t('Changes saved'), subtitle: pagesLabel(order.length), files: [saved] };
};
