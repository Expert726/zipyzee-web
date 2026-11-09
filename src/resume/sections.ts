// What each section form is (design/ResumeSection.dc.html): its kind, its tip, what one entry is called and the
// footer button. The generic SectionForm (src/screens/resume/form) renders a section from this.
import { t } from '@/i18n';
import type { EditorSection } from './progress';

export type SectionKind = 'personal' | 'text' | 'entries' | 'chips' | 'bullets' | 'custom';

export type SectionConfig = {
  kind: SectionKind;
  /** The blue tip box under the form. */
  tip: string;
  /** Entry sections: one entry ("Job"), the add button ("Add job"), the entry form's button ("Save job"). */
  entry?: { one: string; add: string; save: string; of: (n: number, total: number) => string };
  /** Chips and bullets: the empty input's placeholder. */
  placeholder?: string;
};

const ENTRY = {
  get one() { return t('Entry'); },
  get add() { return t('Add entry'); },
  get save() { return t('Save entry'); },
  of: (n: number, total: number) => t('Entry {n} of {total}', { n, total }),
};

export function sectionConfig(key: EditorSection): SectionConfig {
  switch (key) {
    case 'personal':
      return { kind: 'personal', tip: t('Use an email you check often. A professional photo is optional; many ATS-friendly CVs leave it out.') };
    case 'summary':
      return { kind: 'text', tip: t('Two or three sentences: who you are, your years of experience and one result you\'re proud of.') };
    case 'experience':
      return {
        kind: 'entries',
        tip: t('Start with an action word and add a number: "Led", "Built", "Cut costs by 20%".'),
        entry: { one: t('Job'), add: t('Add job'), save: t('Save job'), of: (n, total) => t('Job {n} of {total}', { n, total }) },
      };
    case 'education':
      return { kind: 'entries', tip: t('Put your highest degree first. Add your CGPA or marks if they are good.'), entry: ENTRY };
    case 'projects':
      return {
        kind: 'entries',
        tip: t('Say what you built, with what, and one result: users, stars, marks or time saved.'),
        entry: { one: t('Project'), add: t('Add project'), save: t('Save project'), of: (n, total) => t('Project {n} of {total}', { n, total }) },
      };
    case 'skills':
      return { kind: 'chips', tip: t('List 6 to 10 skills that match the job ad. Hiring systems search for these words.'), placeholder: t('Type a skill, then press Enter') };
    case 'languages':
      return { kind: 'chips', tip: t('Add how well you speak each one: "English (fluent)", "Urdu (native)".'), placeholder: t('Type a language, then press Enter') };
    case 'certifications':
      return { kind: 'bullets', tip: t('Add the name, who gave it and the year: "AWS Certified Developer, 2023".'), placeholder: t('Add a certification') };
    case 'achievements':
      return { kind: 'bullets', tip: t('Awards, rankings and honours. Add a number or a year where you can.'), placeholder: t('Add an achievement') };
    case 'volunteering':
      return { kind: 'bullets', tip: t('Say what you did, where and when, and one number: hours, people helped or money raised.'), placeholder: t('Add volunteer work') };
    case 'publications':
      return { kind: 'bullets', tip: t('One publication per line, in the citation style of your field.'), placeholder: t('Add a publication') };
    default:
      return { kind: 'custom', tip: t('Each point becomes a bullet under this heading on your resume.'), placeholder: t('Add a point') };
  }
}

/** Short month names for the month picker and the date fields ("Mar 2021"). */
export const MONTHS = () => [t('Jan'), t('Feb'), t('Mar'), t('Apr'), t('May'), t('Jun'), t('Jul'), t('Aug'), t('Sep'), t('Oct'), t('Nov'), t('Dec')];
