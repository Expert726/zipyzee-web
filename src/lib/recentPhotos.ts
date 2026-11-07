'use client';
// Recent photos of a tool group (Background remover + Change background share 'bg'), like remove.bg's strip: the last
// RECENT_MAX photos stay in this browser (IndexedDB, src/lib/idb.ts) for RECENT_HOURS hour, so coming back to the tool
// shows them again. Never uploaded; expired ones are deleted whenever the list is read.
import { getAll, write } from './idb';

export const RECENT_MAX = 5;
export const RECENT_HOURS = 1;
const LIFE_MS = RECENT_HOURS * 60 * 60 * 1000;

type Row = { id: string; group: string; name: string; type: string; lastModified: number; blob: Blob; savedAt: number };
/** A kept photo: the File plus its id in the store. */
export type RecentPhoto = { id: string; file: File };

/** The same photo picked twice is kept once. */
export const photoKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

async function rows(group: string): Promise<Row[]> {
  const all = await getAll<Row>('recentphotos');
  const now = Date.now();
  const old = all.filter((r) => now - r.savedAt > LIFE_MS).map((r) => r.id);
  if (old.length) await write('recentphotos', [], old);
  return all.filter((r) => r.group === group && now - r.savedAt <= LIFE_MS).sort((a, b) => b.savedAt - a.savedAt);
}

const toPhoto = (r: Row): RecentPhoto => ({ id: r.id, file: new File([r.blob], r.name, { type: r.type, lastModified: r.lastModified }) });

/** The group's photos, newest first (at most RECENT_MAX, none older than RECENT_HOURS). */
export async function listRecent(group: string): Promise<RecentPhoto[]> {
  try {
    return (await rows(group)).slice(0, RECENT_MAX).map(toPhoto);
  } catch {
    return [];
  }
}

/** Keeps `files` (newest first) and drops the oldest past RECENT_MAX; returns the group's list. */
export async function addRecent(group: string, files: File[]): Promise<RecentPhoto[]> {
  try {
    const now = Date.now();
    const have = await rows(group);
    const keys = new Map(have.map((r) => [`${r.name}|${r.blob.size}|${r.lastModified}`, r]));
    const put: Row[] = files.map((f, i) => {
      const same = keys.get(photoKey(f));
      return { id: same?.id ?? `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`, group, name: f.name, type: f.type, lastModified: f.lastModified, blob: f, savedAt: now + (files.length - i) };
    });
    const keep = new Set(put.map((r) => r.id));
    const rest = have.filter((r) => !keep.has(r.id));
    const drop = rest.slice(Math.max(0, RECENT_MAX - put.length)).map((r) => r.id);
    await write('recentphotos', put, drop);
    return listRecent(group);
  } catch {
    return files.map((file, i) => ({ id: `mem-${i}-${photoKey(file)}`, file }));
  }
}

export async function removeRecent(id: string): Promise<void> {
  try {
    await write('recentphotos', [], [id]);
  } catch {
    // nothing kept: nothing to remove
  }
}
