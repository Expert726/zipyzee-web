'use client';
// Resumes on the web (the app's src/resume/store.ts, zustand + AsyncStorage there): kept in this browser's IndexedDB
// (src/lib/idb.ts, store "resumes"), saved 500 ms after the last change like the app. The same Resume shape, so a
// template renders the same here as on the phone. A photo is kept inside the resume as a small JPEG data URL.
import { useCallback, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { getAll, write } from '@/lib/idb';
import { emptyContent, newId, type Personal, type Resume, type ResumeContent, type ResumeDesign, type SectionKey } from './types';

export const DEFAULT_DESIGN: ResumeDesign = { accent: '#4F46E5', font: 'sans', spacing: 'normal', pageSize: 'A4', showPhoto: false };
export const DEFAULT_SECTION_ORDER: SectionKey[] = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'achievements'];
export const DEFAULT_HIDDEN: SectionKey[] = ['publications', 'volunteering'];

export type CreateOptions = {
  title?: string;
  design?: Partial<ResumeDesign>;
  sectionOrder?: SectionKey[];
  hiddenSections?: SectionKey[];
  personal?: Partial<Personal>;
  content?: Partial<ResumeContent>;
};

let cache: Record<string, Resume> | null = null;
let loading: Promise<Record<string, Resume>> | null = null;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function load(): Promise<Record<string, Resume>> {
  loading ??= getAll<Resume>('resumes')
    .then((list) => (cache = Object.fromEntries(list.map((r) => [r.id, { ...emptyContent(), ...r }]))))
    .catch(() => (cache = {}));
  return loading;
}
const emit = () => listeners.forEach((l) => l());
const saveSoon = (r: Resume) => {
  clearTimeout(timers.get(r.id));
  timers.set(r.id, setTimeout(() => void write('resumes', [r]).catch(() => {}), 500));
};
// a change still waiting is written before the page goes away
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const [id, tm] of timers) {
      clearTimeout(tm);
      const r = cache?.[id];
      if (r) void write('resumes', [r]).catch(() => {});
    }
    timers.clear();
  });
}

export function createResume(templateId: string, opts: CreateOptions = {}): string {
  const now = Date.now();
  const content = emptyContent();
  const resume: Resume = {
    ...content,
    ...opts.content,
    personal: { ...content.personal, ...opts.content?.personal, ...opts.personal },
    id: newId(),
    title: opts.title ?? t('My resume'),
    templateId,
    design: { ...DEFAULT_DESIGN, ...opts.design },
    sectionOrder: opts.sectionOrder ?? [...DEFAULT_SECTION_ORDER],
    hiddenSections: opts.hiddenSections ?? [...DEFAULT_HIDDEN],
    createdAt: now,
    updatedAt: now,
  };
  cache = { ...(cache ?? {}), [resume.id]: resume };
  void write('resumes', [resume]).catch(() => {});
  emit();
  return resume.id;
}

export function updateResume(id: string, patch: Partial<Resume> | ((r: Resume) => Partial<Resume>)) {
  const cur = cache?.[id];
  if (!cur) return;
  const next = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch), updatedAt: Date.now() };
  cache = { ...cache, [id]: next };
  saveSoon(next);
  emit();
}

export function duplicateResume(id: string): string | undefined {
  const cur = cache?.[id];
  if (!cur) return;
  const now = Date.now();
  const copy: Resume = { ...structuredClone(cur), id: newId(), title: t('{title} copy', { title: cur.title }), createdAt: now, updatedAt: now };
  cache = { ...cache, [copy.id]: copy };
  void write('resumes', [copy]).catch(() => {});
  emit();
  return copy.id;
}

export function removeResume(id: string) {
  if (!cache?.[id]) return;
  const next = { ...cache };
  delete next[id];
  cache = next;
  clearTimeout(timers.get(id));
  void write('resumes', [], [id]).catch(() => {});
  emit();
}

/** Every resume, newest change first (undefined while loading). */
export function useResumes(): Resume[] | undefined {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    void load().then(l);
    return () => void listeners.delete(l);
  }, []);
  return cache ? Object.values(cache).sort((a, b) => b.updatedAt - a.updatedAt) : undefined;
}

/** One resume (undefined while loading, null when there's none with this id). */
export function useResume(id: string | null): Resume | null | undefined {
  const all = useResumes();
  const get = useCallback(() => (all === undefined ? undefined : all.find((r) => r.id === id) ?? null), [all, id]);
  return get();
}
