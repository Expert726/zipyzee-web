// Extract archive, the pure parts (unit-tested): an archive's flat entry list as folders you can browse (breadcrumbs,
// folders first), what's in it ("142 files, 38 MB, 3 folders"), what a selection means (a ticked folder = every file
// under it), and which entry paths are safe to write (nothing outside the output folder).
// Copied from the app (src/tools/archive.ts); only this type moved here (the app has it in its native module's spec).
/** One entry of an archive (paths with '/'). */
export type ArchiveEntry = { path: string; size: number; packed: number; dir: boolean; encrypted: boolean };

export type ArchiveFolder = { name: string; path: string; files: number; size: number };
export type ArchiveFile = { name: string; path: string; size: number; encrypted: boolean };
export type ArchiveDir = { folders: ArchiveFolder[]; files: ArchiveFile[] };

/** An entry path that may be written: relative, no "..", no drive letter, not empty. */
export function isSafeEntry(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  return !!p && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p) && !p.split('/').includes('..');
}

const parentOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** Only real files, safe, de-duplicated (an archive can list a file twice). */
export function filesOf(entries: ArchiveEntry[]): ArchiveFile[] {
  const seen = new Set<string>();
  const out: ArchiveFile[] = [];
  for (const e of entries) {
    const path = e.path.replace(/\\/g, '/').replace(/\/+$/, '');
    if (e.dir || !isSafeEntry(path) || seen.has(path)) continue;
    // hidden macOS leftovers in ZIPs made on a Mac
    if (path.startsWith('__MACOSX/') || nameOf(path) === '.DS_Store') continue;
    seen.add(path);
    out.push({ name: nameOf(path), path, size: Math.max(0, e.size), encrypted: e.encrypted });
  }
  return out;
}

/** One folder's contents: sub-folders (with how many files and bytes are under each) A-Z, then files A-Z. */
export function listDir(files: ArchiveFile[], dir: string): ArchiveDir {
  const prefix = dir ? `${dir}/` : '';
  const folders = new Map<string, ArchiveFolder>();
  const here: ArchiveFile[] = [];
  for (const f of files) {
    if (!f.path.startsWith(prefix)) continue;
    const rest = f.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash < 0) {
      here.push(f);
      continue;
    }
    const name = rest.slice(0, slash);
    const g = folders.get(name) ?? { name, path: prefix + name, files: 0, size: 0 };
    g.files++;
    g.size += f.size;
    folders.set(name, g);
  }
  const az = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  return { folders: [...folders.values()].sort(az), files: here.sort(az) };
}

/** "Archive › photos › 2024": each step with the folder it opens ('' = the top). */
export function breadcrumbs(dir: string): { name: string; path: string }[] {
  const parts = dir ? dir.split('/') : [];
  return parts.map((name, i) => ({ name, path: parts.slice(0, i + 1).join('/') }));
}

export const parentDir = parentOf;

/** Files, total size and folders in the whole archive. */
export function summary(files: ArchiveFile[]): { files: number; size: number; folders: number } {
  const dirs = new Set<string>();
  for (const f of files) {
    let p = parentOf(f.path);
    while (p) {
      dirs.add(p);
      p = parentOf(p);
    }
  }
  return { files: files.length, size: files.reduce((s, f) => s + f.size, 0), folders: dirs.size };
}

/** The files a selection means: ticked files, plus every file under a ticked folder. Empty selection = nothing. */
export function selectedFiles(files: ArchiveFile[], picked: Set<string>): ArchiveFile[] {
  if (!picked.size) return [];
  return files.filter((f) => {
    if (picked.has(f.path)) return true;
    let p = parentOf(f.path);
    while (p) {
      if (picked.has(p)) return true;
      p = parentOf(p);
    }
    return false;
  });
}

/** Whether a folder is fully / partly ticked (for its checkbox). */
export function folderState(files: ArchiveFile[], picked: Set<string>, folder: string): 'all' | 'some' | 'none' {
  const inside = files.filter((f) => f.path.startsWith(`${folder}/`));
  if (!inside.length) return 'none';
  const chosen = selectedFiles(inside, picked).length;
  return chosen === inside.length ? 'all' : chosen ? 'some' : 'none';
}

/** The output folder's name for an archive: "photos-2024.zip" -> "photos-2024" (safe for a path). */
export function outFolderName(archiveName: string): string {
  const stem = archiveName.replace(/\.(zip|rar|7z|tar|gz|tgz)$/i, '').replace(/\.(tar)$/i, '');
  return stem.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'archive';
}

/** Archive by name, for the picker (the module checks the real format from the file's first bytes). */
export const isArchiveName = (name: string) => /\.(zip|rar|7z)$/i.test(name);

/** "report.zip" from a name typed for Make a ZIP. */
export function zipFileName(typed: string, fallback: string): string {
  const clean = typed.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.zip$/i, '').slice(0, 80);
  return `${clean || fallback}.zip`;
}

/** Names inside a new ZIP: each file once ("photo.jpg", "photo (2).jpg"). */
export function uniqueNames(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    if (!count) return n;
    const dot = n.lastIndexOf('.');
    return dot > 0 ? `${n.slice(0, dot)} (${count + 1})${n.slice(dot)}` : `${n} (${count + 1})`;
  });
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic',
  txt: 'text/plain', csv: 'text/csv', html: 'text/html', json: 'application/json', zip: 'application/zip', mp3: 'audio/mpeg', mp4: 'video/mp4',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** A file's type from its name (extracted files carry no type of their own). */
export const mimeOfName = (name: string) => MIME[(name.split('.').pop() ?? '').toLowerCase()] ?? 'application/octet-stream';
