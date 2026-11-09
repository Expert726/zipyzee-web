'use client';
// Archives in the browser (the app: zip4j, Commons Compress and junrar natively, modules/ArchiveModule.kt):
//   ZIP (open, with or without a password, and make, AES-256): @zip.js/zip.js (BSD-3)
//   RAR and 7z (open): libarchive.js (MIT), its worker and WebAssembly from /libarchive (scripts/copy-pdfjs.mjs)
// Nothing is uploaded. Paths and the browsing / selection rules: src/tools/archive.ts.
import { isArchiveName, type ArchiveEntry } from '@/tools/archive';

export const MAX_ENTRIES = 20_000;

export class PasswordError extends Error {
  constructor() {
    super('password');
  }
}

export type OpenArchive = {
  format: 'zip' | 'rar' | '7z';
  entries: ArchiveEntry[];
  needsPassword: boolean;
  /** One file's contents; throws PasswordError when the password is missing or wrong. */
  read(path: string, password?: string): Promise<Blob>;
};

const formatOf = (name: string): OpenArchive['format'] => (/\.rar$/i.test(name) ? 'rar' : /\.7z$/i.test(name) ? '7z' : 'zip');

async function openZip(file: File): Promise<OpenArchive> {
  const zip = await import('@zip.js/zip.js');
  zip.configure({ useWebWorkers: false });
  const reader = new zip.ZipReader(new zip.BlobReader(file));
  const list = await reader.getEntries();
  const byPath = new Map(list.map((e) => [e.filename, e]));
  return {
    format: 'zip',
    needsPassword: list.some((e) => e.encrypted),
    entries: list.map((e) => ({ path: e.filename, size: e.uncompressedSize, packed: e.compressedSize, dir: e.directory, encrypted: e.encrypted })),
    async read(path, password) {
      const e = byPath.get(path);
      if (!e || e.directory) throw new Error('missing');
      try {
        return await (e as unknown as { getData(w: unknown, o?: object): Promise<Blob> }).getData(new zip.BlobWriter(), { password: e.encrypted ? password : undefined });
      } catch (err) {
        if (e.encrypted && /password|encrypt/i.test(String(err))) throw new PasswordError();
        throw err;
      }
    },
  };
}

async function openLibarchive(file: File, password?: string): Promise<OpenArchive> {
  const { Archive } = await import('libarchive.js');
  Archive.init({ workerUrl: '/libarchive/worker-bundle.js' });
  const archive = await Archive.open(file);
  const encrypted = !!(await archive.hasEncryptedData());
  if (encrypted && password) await archive.usePassword(password);
  type Item = { file: { name: string; size: number; extract(): Promise<File> }; path: string };
  let items: Item[];
  try {
    items = (await archive.getFilesArray()) as Item[];
  } catch {
    if (encrypted) throw new PasswordError();
    throw new Error('read');
  }
  const byPath = new Map(items.map((i) => [`${i.path}${i.file.name}`, i]));
  return {
    format: formatOf(file.name),
    needsPassword: encrypted && !password,
    entries: items.map((i) => ({ path: `${i.path}${i.file.name}`, size: i.file.size ?? 0, packed: 0, dir: false, encrypted })),
    async read(path) {
      const it = byPath.get(path);
      if (!it) throw new Error('missing');
      try {
        return await it.file.extract();
      } catch {
        if (encrypted) throw new PasswordError();
        throw new Error('read');
      }
    },
  };
}

/** What's inside a ZIP, RAR or 7z. RAR / 7z with a password need it to list their files. */
export async function openArchive(file: File, password?: string): Promise<OpenArchive> {
  if (!isArchiveName(file.name)) throw new Error('not an archive');
  const a = formatOf(file.name) === 'zip' ? await openZip(file) : await openLibarchive(file, password);
  if (a.entries.length > MAX_ENTRIES) throw new Error('too many');
  return a;
}

export type ZipLevel = 'fast' | 'normal' | 'max';

/** A ZIP of `files` (path in the ZIP -> contents), AES-256 when there's a password. */
export async function makeZipBlob(files: { path: string; blob: Blob }[], level: ZipLevel, password?: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const zip = await import('@zip.js/zip.js');
  zip.configure({ useWebWorkers: false });
  const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'), {
    level: level === 'fast' ? 1 : level === 'max' ? 9 : 6,
    ...(password ? { password, encryptionStrength: 3 as const } : {}),
  });
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    await writer.add(files[i].path, new zip.BlobReader(files[i].blob));
  }
  return writer.close();
}
