'use client';
// Text editor documents, kept in this browser (IndexedDB "zipyzee" / "textdocs", src/lib/idb.ts: room for pictures, unlike
// localStorage). The app's src/textdocs/store.ts model. One store for the page: useDocs() re-renders on changes;
// writes go to the database 500 ms after the last change (and right away when the page is hidden).
import { useSyncExternalStore } from 'react';
import { getAll, write } from '@/lib/idb';
import type { PageAlign, PageFont, PageSize } from './page';

export type TextDoc = {
  id: string;
  title: string;
  /** Plain text (word count, previews, the title when none is typed). */
  text: string;
  html: string;
  font: PageFont;
  size: PageSize;
  align: PageAlign;
  createdAt: number;
  updatedAt: number;
};

export const DOC_SAVE_DELAY_MS = 500;

type State = { ready: boolean; docs: Record<string, TextDoc>; savedAt: number | null; error: boolean };
let state: State = { ready: false, docs: {}, savedAt: null, error: false };
const listeners = new Set<() => void>();
const emit = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
};

let loading = false;
function load() {
  if (loading || state.ready) return;
  loading = true;
  getAll<TextDoc>('textdocs')
    .then((all) => emit({ ready: true, docs: Object.fromEntries(all.map((d) => [d.id, d])) }))
    .catch(() => emit({ ready: true, error: true }));
}

// ---------- saving (debounced) ----------
const dirty = new Set<string>();
const removed = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export async function flushDocs() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!dirty.size && !removed.size) return;
  const put = [...dirty].map((id) => state.docs[id]).filter(Boolean);
  const del = [...removed];
  dirty.clear();
  removed.clear();
  try {
    await write('textdocs', put, del);
    emit({ savedAt: Date.now(), error: false });
  } catch {
    // full (big pictures) or blocked: keep it in memory and say so
    put.forEach((d) => dirty.add(d.id));
    emit({ error: true });
  }
}

const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushDocs(), DOC_SAVE_DELAY_MS);
};

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && void flushDocs());
  window.addEventListener('pagehide', () => void flushDocs());
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const docsApi = {
  create(): string {
    const now = Date.now();
    const doc: TextDoc = { id: newId(), title: '', text: '', html: '', font: 'sans', size: 'm', align: 'start', createdAt: now, updatedAt: now };
    emit({ docs: { ...state.docs, [doc.id]: doc } });
    dirty.add(doc.id);
    schedule();
    return doc.id;
  },
  update(id: string, patch: Partial<Omit<TextDoc, 'id' | 'createdAt'>>) {
    const cur = state.docs[id];
    if (!cur) return;
    emit({ docs: { ...state.docs, [id]: { ...cur, ...patch, updatedAt: Date.now() } } });
    dirty.add(id);
    schedule();
  },
  duplicate(id: string, title: string): string | undefined {
    const src = state.docs[id];
    if (!src) return undefined;
    const now = Date.now();
    const copy = { ...src, id: newId(), title, createdAt: now, updatedAt: now };
    emit({ docs: { ...state.docs, [copy.id]: copy } });
    dirty.add(copy.id);
    schedule();
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
  get: (id: string): TextDoc | undefined => state.docs[id],
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  load();
  return () => listeners.delete(fn);
};
const SERVER: State = { ready: false, docs: {}, savedAt: null, error: false };

/** The documents (and whether they're loaded, the last save, a save error). */
export const useDocs = () => useSyncExternalStore(subscribe, () => state, () => SERVER);
