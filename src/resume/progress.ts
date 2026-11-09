// Editor progress (design/ResumeEditor.dc.html): the card ("6 of 8 sections done", 85%, "Add languages to reach 100%.
// Saved automatically.") and each section row's status (Done, "2 jobs", "2 entries", "6 skills", Add). Pure, tested.
//   X of Y   every section in the editor (Personal details + the visible sections) that has something in it.
//   percent  only the core sections, weighted: Personal 20, Summary 15, Experience 20, Education 15, Skills 15,
//            Languages 15 (the board's state is exactly 85). Extras (Certifications, Achievements, ...) don't change
//            it; a hidden core section leaves the total, so 100% is always reachable.
import { t } from '@/i18n';
import { isCustomKey, type Resume, type SectionKey } from './types';

export type EditorSection = 'personal' | SectionKey;

const WEIGHTS: Partial<Record<EditorSection, number>> = {
  personal: 20, summary: 15, experience: 20, education: 15, skills: 15, languages: 15,
};

const LABELS: Record<Exclude<EditorSection, `custom:${string}`>, string> = {
  get personal() { return t('Personal details'); },
  get summary() { return t('Profile summary'); },
  get experience() { return t('Experience'); },
  get education() { return t('Education'); },
  get skills() { return t('Skills'); },
  get projects() { return t('Projects'); },
  get certifications() { return t('Certifications'); },
  get languages() { return t('Languages'); },
  get achievements() { return t('Achievements'); },
  get publications() { return t('Publications'); },
  get volunteering() { return t('Volunteering'); },
};

/** The editor's list: Personal details, then the sections in order, without hidden ones. */
export const editorSections = (r: Resume): EditorSection[] => ['personal', ...r.sectionOrder.filter((k) => !r.hiddenSections.includes(k))];

export function sectionLabel(r: Resume, key: EditorSection): string {
  if (key !== 'personal' && isCustomKey(key)) return r.customSections.find((c) => `custom:${c.id}` === key)?.title || t('Custom section');
  return LABELS[key];
}

/** How many entries a section has (1 for filled text sections, 0 when empty). */
export function sectionCount(r: Resume, key: EditorSection): number {
  switch (key) {
    case 'personal': {
      const p = r.personal;
      // name plus at least one way to contact them (the same rule Download checks)
      return p.fullName.trim() && (p.email.trim() || p.phone.trim()) ? 1 : 0;
    }
    case 'summary':
      return r.summary.trim() ? 1 : 0;
    case 'experience':
    case 'education':
    case 'skills':
    case 'projects':
    case 'certifications':
    case 'languages':
    case 'achievements':
    case 'publications':
    case 'volunteering':
      return r[key].length;
    default:
      return r.customSections.find((c) => `custom:${c.id}` === key)?.bullets.filter((b) => b.trim()).length ?? 0;
  }
}

export const isSectionDone = (r: Resume, key: EditorSection) => sectionCount(r, key) > 0;

/** The row's right-hand text: Done, "2 jobs", "2 entries", "6 skills", or Add. */
export function sectionStatus(r: Resume, key: EditorSection): string {
  const n = sectionCount(r, key);
  if (!n) return t('Add');
  if (key === 'personal' || key === 'summary') return t('Done');
  if (key === 'experience') return n === 1 ? t('1 job') : t('{count} jobs', { count: n });
  if (key === 'skills') return n === 1 ? t('1 skill') : t('{count} skills', { count: n });
  if (key === 'languages') return n === 1 ? t('1 language') : t('{count} languages', { count: n });
  return n === 1 ? t('1 entry') : t('{count} entries', { count: n });
}

export type Progress = {
  done: number;
  total: number;
  /** "6 of 8 sections done" */
  label: string;
  /** 0-100 */
  percent: number;
  /** The first core section still empty (what the hint asks for), or null at 100%. */
  next: EditorSection | null;
  /** "Add languages to reach 100%. Saved automatically." */
  hint: string;
};

export function resumeProgress(r: Resume): Progress {
  const shown = editorSections(r);
  const done = shown.filter((k) => isSectionDone(r, k)).length;
  const core = shown.filter((k) => WEIGHTS[k] != null);
  const totalWeight = core.reduce((s, k) => s + (WEIGHTS[k] ?? 0), 0);
  const doneWeight = core.filter((k) => isSectionDone(r, k)).reduce((s, k) => s + (WEIGHTS[k] ?? 0), 0);
  const percent = totalWeight ? Math.round((doneWeight / totalWeight) * 100) : 100;
  const next = core.find((k) => !isSectionDone(r, k)) ?? null;
  const saved = t('Saved automatically.');
  return {
    done,
    total: shown.length,
    label: t('{done} of {total} sections done', { done, total: shown.length }),
    percent,
    next,
    hint: next
      ? `${t('Add {section} to reach 100%.', { section: sectionLabel(r, next).toLowerCase() })} ${saved}`
      : `${t('Your resume is complete.')} ${saved}`,
  };
}
