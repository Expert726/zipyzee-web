import { t } from '@/i18n';
import { formatBytes } from '@/lib/format';
import { makeZipBlob, PasswordError, type OpenArchive, type ZipLevel } from '@/lib/archive';
import { stepper } from '@/lib/pdf';
import { outFolderName, uniqueNames, zipFileName } from '../archive';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

// Extract ZIP / RAR and Make a ZIP (the app's handlers/extractArchive.ts and makeZip.ts), in the browser
// (src/lib/archive.ts).

/** The files ticked in the editor (components/flow/custom/ArchiveEditor), with their folders in their names. */
export const extractArchive: ToolHandler = async (ctx) => {
  const { files, options, signal } = ctx;
  const archive = options.archive as OpenArchive | undefined;
  const paths = (options.paths as string[] | undefined) ?? [];
  if (!archive || !paths.length) throw new ToolError(t('Tick at least one file.'));
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  let size = 0;
  for (let i = 0; i < paths.length; i++) {
    if (signal.cancelled) break;
    await step(i, paths.length, t('File {n} of {total}', { n: i + 1, total: paths.length }));
    try {
      const blob = await archive.read(paths[i], String(options.password ?? '') || undefined);
      out.push({ name: paths[i], blob });
      size += blob.size;
    } catch (e) {
      if (e instanceof PasswordError) throw new ToolError(t('Wrong password. Try again.'));
      throw new ToolError(t('{name} couldn\'t be extracted. The archive may be damaged.', { name: paths[i] }));
    }
  }
  return {
    title: t('Extracted'),
    subtitle: `${out.length === 1 ? t('1 file') : t('{count} files', { count: out.length })} · ${formatBytes(size)}`,
    files: out,
    zipName: `${outFolderName(files[0].name)}.zip`,
  };
};

/** Make a ZIP: the picked files in one ZIP (names kept, duplicates numbered), AES-256 with a password. */
export const makeZip: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  if (!files.length) throw new ToolError(t('Choose files'));
  const protect = !!options.protect;
  const password = String(options.password ?? '');
  if (protect && !password) throw new ToolError(t('Enter a password'));
  const step = stepper(ctx);
  const names = uniqueNames(files.map((f) => f.name));
  const blob = await makeZipBlob(
    files.map((f, i) => ({ path: names[i], blob: f })),
    (options.level as ZipLevel) ?? 'normal',
    protect ? password : undefined,
    (done, total) => void step(done, total, t('File {n} of {total}', { n: done + 1, total })),
  );
  return {
    title: t('ZIP ready'),
    subtitle: `${files.length === 1 ? t('1 file') : t('{count} files', { count: files.length })} · ${formatBytes(blob.size)}${protect ? ` · ${t('Password protected')}` : ''}`,
    files: [{ name: zipFileName(String(options.name ?? ''), files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : t('files')), blob }],
  };
};
