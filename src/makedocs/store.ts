'use client';
// Make with Zee documents, kept in this browser for 24 hours after their last change (the app's src/makedocs/store.ts).
// IndexedDB "zipyzee" / "zeedocs" (src/lib/idb.ts); pictures live inside the document as data URLs. Edits show at once,
// the write waits 500 ms (and happens right away when the page is hidden). Expired documents go when the list loads.
import { useSyncExternalStore } from 'react';
import { getAll, write } from '@/lib/idb';
import { newId } from './edit';
import { DEFAULT_SETTINGS, DOC_LIFE_MS, type Block, type DocKind, type DocLanguage, type ZeeDoc } from './types';

const SAVE_DELAY_MS = 500;

type State = { ready: boolean; docs: Record<string, ZeeDoc>; savedAt: number | null; error: boolean };
let state: State = { ready: false, docs: {}, savedAt: null, error: false };
const listeners = new Set<() => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

const dirty = new Set<string>();
const removed = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export async function flushZeeDocs() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!dirty.size && !removed.size) return;
  const put = [...dirty].map((id) => state.docs[id]).filter(Boolean);
  const del = [...removed];
  dirty.clear();
  removed.clear();
  try {
    await write('zeedocs', put, del);
    emit({ savedAt: Date.now(), error: false });
  } catch {
    put.forEach((d) => dirty.add(d.id));
    emit({ error: true });
  }
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushZeeDocs(), SAVE_DELAY_MS);
};

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flushZeeDocs());
  window.addEventListener('pagehide', () => void flushZeeDocs());
}

const set = (doc: ZeeDoc) => {
  emit({ docs: { ...state.docs, [doc.id]: doc } });
  dirty.add(doc.id);
  schedule();
};

type NewDoc = { kind: DocKind; title?: string; language?: DocLanguage; blocks: Block[] };
type Patch = Partial<Pick<ZeeDoc, 'title' | 'kind' | 'language' | 'blocks' | 'settings'>>;

export const zeeDocs = {
  create({ kind, title = '', language = 'en', blocks }: NewDoc): string {
    const now = Date.now();
    const doc: ZeeDoc = { id: newId(), kind, title, language, blocks, settings: { ...DEFAULT_SETTINGS }, createdAt: now, updatedAt: now, expiresAt: now + DOC_LIFE_MS };
    set(doc);
    return doc.id;
  },
  update(id: string, patch: Patch) {
    const cur = state.docs[id];
    if (!cur) return;
    const now = Date.now();
    set({ ...cur, ...patch, updatedAt: now, expiresAt: now + DOC_LIFE_MS });
  },
  duplicate(id: string, title: string): string | undefined {
    const src = state.docs[id];
    if (!src) return undefined;
    const now = Date.now();
    const copy: ZeeDoc = { ...(JSON.parse(JSON.stringify(src)) as ZeeDoc), id: newId(), title, createdAt: now, updatedAt: now, expiresAt: now + DOC_LIFE_MS };
    set(copy);
    return copy.id;
  },
  remove(id: string) {
    const rest = { ...state.docs };
    delete rest[id];
    emit({ docs: rest });
    dirty.delete(id);
    removed.add(id);
    schedule();
  },
  get: (id: string): ZeeDoc | undefined => state.docs[id],
};

let loading = false;
function load() {
  if (loading || state.ready) return;
  loading = true;
  getAll<ZeeDoc>('zeedocs')
    .then((all) => {
      const now = Date.now();
      const keep = all.filter((d) => d.expiresAt > now);
      all.filter((d) => d.expiresAt <= now).forEach((d) => removed.add(d.id));
      if (removed.size) schedule();
      emit({ ready: true, docs: Object.fromEntries(keep.map((d) => [d.id, d])) });
    })
    .catch(() => emit({ ready: true, error: true }));
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  load();
  return () => listeners.delete(fn);
};
const SERVER: State = { ready: false, docs: {}, savedAt: null, error: false };

export const useZeeDocs = () => useSyncExternalStore(subscribe, () => state, () => SERVER);
