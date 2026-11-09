// Editing a resume (design/ResumeEditor, ResumeSection): pure helpers the editor and the section forms use, each
// returning a patch for useResumes.update. Unit-tested in __tests__/resumeEditing.test.ts.
import { PERSONA_IDS, samplePersona, type PersonaId } from './sampleData';
import { customKey, newId, type BuiltInSection, type Education, type Experience, type Project, type Resume, type ResumeContent, type SectionKey } from './types';
import type { EditorSection } from './progress';
import { getTemplate } from './templates';

/** Download needs a name and at least one way to contact the person (email or phone). */
export const canDownload = (r: Resume) => !!r.personal.fullName.trim() && !!(r.personal.email.trim() || r.personal.phone.trim());

/**
 * The full sectionOrder after the visible sections were dragged into `visible`: hidden sections keep their slots,
 * the visible ones fill the other slots in the new order.
 */
export function reorderVisible(order: SectionKey[], hidden: SectionKey[], visible: SectionKey[]): SectionKey[] {
  const queue = [...visible];
  const out = order.map((k) => (hidden.includes(k) ? k : queue.shift() ?? k));
  // anything visible that wasn't in the order yet goes at the end
  return [...out, ...queue.filter((k) => !out.includes(k))];
}

export const hideSection = (r: Resume, key: SectionKey): Partial<Resume> =>
  r.hiddenSections.includes(key) ? {} : { hiddenSections: [...r.hiddenSections, key] };

/** Shows a hidden section again, at the end of the list. */
export const showSection = (r: Resume, key: SectionKey): Partial<Resume> => ({
  hiddenSections: r.hiddenSections.filter((k) => k !== key),
  sectionOrder: [...r.sectionOrder.filter((k) => k !== key), key],
});

/** A new custom section at the end. Returns the patch and its key. */
export function addCustomSection(r: Resume, title: string): { patch: Partial<Resume>; key: SectionKey } {
  const id = newId();
  const key = customKey(id);
  return {
    key,
    patch: { customSections: [...r.customSections, { id, title: title.trim(), bullets: [] }], sectionOrder: [...r.sectionOrder, key] },
  };
}

export const removeCustomSection = (r: Resume, key: SectionKey): Partial<Resume> => ({
  customSections: r.customSections.filter((c) => customKey(c.id) !== key),
  sectionOrder: r.sectionOrder.filter((k) => k !== key),
  hiddenSections: r.hiddenSections.filter((k) => k !== key),
});

// ---------- entries (experience, education, projects) ----------

export type EntrySection = 'experience' | 'education' | 'projects';
export type Entry = Experience | Education | Project;

export const isEntrySection = (s: EditorSection): s is EntrySection => s === 'experience' || s === 'education' || s === 'projects';

export function emptyEntry(section: EntrySection): Entry {
  const id = newId();
  if (section === 'experience') return { id, role: '', company: '', city: '', start: '', end: '', current: false, bullets: [] };
  if (section === 'education') return { id, degree: '', school: '', start: '', end: '', current: false, details: '' };
  return { id, name: '', description: '', link: '' };
}

/** Nothing typed in it (a "current" switch alone doesn't count). */
export function isEmptyEntry(e: Entry): boolean {
  return Object.entries(e).every(([k, v]) => {
    if (k === 'id' || k === 'current') return true;
    if (Array.isArray(v)) return v.every((b) => !String(b).trim());
    return !String(v ?? '').trim();
  });
}

export const entriesOf = (r: Resume, s: EntrySection): Entry[] => r[s];

export const setEntries = (s: EntrySection, list: Entry[]): Partial<Resume> => ({ [s]: list } as Partial<Resume>);

export const updateEntry = (r: Resume, s: EntrySection, id: string, change: Partial<Entry>): Partial<Resume> =>
  setEntries(s, entriesOf(r, s).map((e) => (e.id === id ? ({ ...e, ...change } as Entry) : e)));

export const removeEntry = (r: Resume, s: EntrySection, id: string): Partial<Resume> => setEntries(s, entriesOf(r, s).filter((e) => e.id !== id));

/** Moves an item one place up (-1) or down (+1). */
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// ---------- examples ----------

/** The section's content from a persona: the template's own, or the first persona that has some. */
export function exampleContent(persona: PersonaId, section: Exclude<keyof ResumeContent, 'customSections'>): ResumeContent {
  const own = samplePersona(persona);
  if (hasSome(own, section)) return own;
  for (const id of PERSONA_IDS) {
    const c = samplePersona(id);
    if (hasSome(c, section)) return c;
  }
  return own;
}

const hasSome = (c: ResumeContent, section: Exclude<keyof ResumeContent, 'customSections'>) => {
  const v = c[section];
  return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? !!v.trim() : !!v.fullName;
};

export const BUILT_IN_KEYS: BuiltInSection[] = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'achievements', 'publications', 'volunteering'];

// ---------- words and dates ----------

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export type MonthYear = { year: number; month?: number };

/** '2021-03' -> { 2021, 3 }, '2021' -> { 2021 }; anything else -> null. */
export function parseMonthYear(s: string): MonthYear | null {
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s.trim());
  if (!m) return null;
  const month = m[2] ? Number(m[2]) : undefined;
  return { year: Number(m[1]), ...(month && month >= 1 && month <= 12 ? { month } : {}) };
}

export const formatMonthYear = (v: MonthYear): string => (v.month ? `${v.year}-${String(v.month).padStart(2, '0')}` : String(v.year));

// ---------- design ----------

/**
 * Another template for the same resume (design/ResumeDesign.dc.html strip): every word, the section order and the
 * hidden sections stay. The new template brings its own colour and font, so it looks like its board; the person's
 * spacing and page size stay, and a photo they added stays on.
 */
export function switchTemplate(r: Resume, templateId: string): Partial<Resume> {
  const tpl = getTemplate(templateId);
  return {
    templateId: tpl.id,
    design: { ...r.design, accent: tpl.accent, font: tpl.fontKind, showPhoto: !!tpl.photo || (!!r.personal.photoUri && r.design.showPhoto) },
  };
}
