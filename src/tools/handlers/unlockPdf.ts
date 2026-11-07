import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { savePdf, stepper } from '@/lib/pdf';
import { losslessPass } from '../pdfShrink';
import { ToolError, type ToolHandler } from '../types';

// Unlock PDF (the app's handlers/unlockPdf.ts): opened with the password you know (@cantoo/pdf-lib, loaded only here,
// reads AES and RC4 encryption), then saved without it. The result is reopened with pdf-lib and tidied (the old
// encryption objects nothing points to are dropped), which also proves it opens without a password.
export const unlockPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const password = String(options.password ?? '');

  await step(0, 2, t('Checking password'));
  const fork = await import('@cantoo/pdf-lib');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const probe = await fork.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }).catch(() => null);
  if (!probe) throw new ToolError(t('{fileName} could not be opened. It may be damaged.', { fileName: file.name }));
  if (!probe.isEncrypted) throw new ToolError(t('{fileName} has no password. There\'s nothing to unlock.', { fileName: file.name }));
  let open;
  try {
    open = await fork.PDFDocument.load(bytes, { password, updateMetadata: false });
  } catch (e) {
    if (/password/i.test(String((e as Error)?.message))) throw new ToolError(t('That password didn\'t work. Check it and try again.'));
    throw new ToolError(t('{fileName} could not be opened. It may be damaged.', { fileName: file.name }));
  }

  await step(1, 2, t('Saving'));
  const doc = await PDFDocument.load(await open.save(), { updateMetadata: false });
  await losslessPass(doc);
  const saved = await savePdf(doc, `${fileStem(file.name)}-unlocked.pdf`);
  return { title: t('Password removed'), files: [saved] };
};
