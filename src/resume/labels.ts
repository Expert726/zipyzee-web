// What the app shows about a template (design/ResumeTemplates, ResumePreview): its name, group and badge in the
// app's language, the trait pills on the preview, and the accent swatches. The templates themselves (./templates)
// stay free of i18n so the thumbnail script can run them in Node.
import { t } from '@/i18n';
import { badgeOf, TEMPLATES, type FilterChip, type TemplateConfig } from './templates';

const NAMES: Record<string, () => string> = {
  classic: () => t('Classic'),
  'clean-ats': () => t('Clean ATS'),
  minimal: () => t('Minimal'),
  executive: () => t('Executive'),
  corporate: () => t('Corporate'),
  banker: () => t('Banker'),
  'modern-sidebar': () => t('Modern sidebar'),
  timeline: () => t('Timeline'),
  'accent-bar': () => t('Accent bar'),
  'bold-header': () => t('Bold header'),
  designer: () => t('Designer'),
  'bold-name': () => t('Bold name'),
  fresher: () => t('Fresher'),
  internship: () => t('Internship'),
  academic: () => t('Academic CV'),
  'pakistan-gov': () => t('Pakistan government CV'),
  harvard: () => t('Harvard'),
  compact: () => t('Compact'),
  'skills-first': () => t('Skills first'),
  chronological: () => t('Chronological'),
  'simple-serif': () => t('Simple serif'),
  plain: () => t('Plain'),
  consultant: () => t('Consultant'),
  manager: () => t('Manager'),
  director: () => t('Director'),
  lawyer: () => t('Lawyer'),
  doctor: () => t('Doctor'),
  engineer: () => t('Engineer'),
  teacher: () => t('Teacher'),
  'split-column': () => t('Split column'),
  cards: () => t('Cards'),
  'icon-contact': () => t('Icon contact'),
  'dates-left': () => t('Dates left'),
  mono: () => t('Mono'),
  tech: () => t('Tech'),
  'clean-grid': () => t('Clean grid'),
  magazine: () => t('Magazine'),
  'color-block': () => t('Color block'),
  portfolio: () => t('Portfolio'),
  'photo-banner': () => t('Photo banner'),
  marketing: () => t('Marketing'),
  artist: () => t('Artist'),
  studio: () => t('Studio'),
  'school-leaver': () => t('School leaver'),
  scholarship: () => t('Scholarship CV'),
  'first-job': () => t('First job'),
  graduate: () => t('Graduate'),
  'research-assistant': () => t('Research assistant'),
  volunteer: () => t('Volunteer'),
  'teaching-assistant': () => t('Teaching assistant'),
};

const CHIPS: Record<FilterChip | 'ATS', () => string> = {
  All: () => t('All'),
  'ATS-friendly': () => t('ATS-friendly'),
  Professional: () => t('Professional'),
  Modern: () => t('Modern'),
  Creative: () => t('Creative'),
  Student: () => t('Student'),
  ATS: () => t('ATS'),
};

export const templateName = (tpl: TemplateConfig) => NAMES[tpl.id]?.() ?? tpl.name;

/** A filter chip or a template's group, translated. */
export const chipLabel = (chip: FilterChip) => CHIPS[chip]();

/** The small badge on a gallery card ("ATS" or the group), translated. */
export const badgeLabel = (tpl: TemplateConfig) => CHIPS[badgeOf(tpl)]();

/** Templates a hiring system reads cleanly: one column of plain text, no colour block, banner, dark sidebar or photo. */
export function isAtsFriendly(tpl: TemplateConfig): boolean {
  if (tpl.group === 'ATS-friendly') return true;
  if (tpl.layout === 'block' || tpl.layout === 'banner' || tpl.header === 'bar' || tpl.header === 'big' || tpl.header === 'magazine') return false;
  return !tpl.sidebarDark && !tpl.photo;
}

/** The pills under the preview: "ATS-friendly" (when it is) and what the layout is like. */
export function templateTraits(tpl: TemplateConfig): { label: string; ats?: boolean }[] {
  const out: { label: string; ats?: boolean }[] = [];
  if (isAtsFriendly(tpl)) out.push({ label: t('ATS-friendly'), ats: true });
  if (tpl.layout === 'sidebar') out.push({ label: t('Sidebar for skills') });
  else if (tpl.layout === 'block') out.push({ label: t('Bold header block') });
  else if (tpl.layout === 'gov') out.push({ label: t('Government format') });
  else if (tpl.layout === 'twocol') out.push({ label: t('Two columns') });
  else if (tpl.layout === 'cards') out.push({ label: t('Card sections') });
  else if (tpl.layout === 'dates') out.push({ label: t('Titles on the left') });
  else if (tpl.layout === 'stripe') out.push({ label: t('Side stripe') });
  else if (tpl.layout === 'banner') out.push({ label: t('Photo banner') });
  else if (tpl.timeline) out.push({ label: t('Timeline') });
  else if (tpl.dense) out.push({ label: t('Fits more on a page') });
  else out.push({ label: t('Single column') });
  if (tpl.photo) out.push({ label: t('Photo') });
  return out;
}

/** The accent swatches (design/ResumePreview, ResumeDesign). */
export const ACCENTS: { color: string; label: () => string }[] = [
  { color: '#0F766E', label: () => t('Teal') },
  { color: '#1E3A8A', label: () => t('Navy') },
  { color: '#4F46E5', label: () => t('Indigo') },
  { color: '#7F1D1D', label: () => t('Maroon') },
  { color: '#111827', label: () => t('Black') },
  { color: '#B45309', label: () => t('Amber') },
];

/** The swatches for a template: its own colour first when it isn't one of the six. */
export function accentsFor(tpl: TemplateConfig): { color: string; label: string }[] {
  const list = ACCENTS.map((a) => ({ color: a.color, label: a.label() }));
  const own = tpl.accent.toUpperCase();
  return list.some((a) => a.color === own) ? list : [{ color: own, label: t('Template color') }, ...list];
}

/** "Popular templates" on the Resume tab (design/ResumeHome.dc.html). */
/** The Resume tab's strip: 10 popular templates, a mix of every style (scrolls sideways). */
export const POPULAR_TEMPLATES = [
  'clean-ats', 'modern-sidebar', 'executive', 'corporate', 'fresher', 'bold-header', 'timeline', 'pakistan-gov', 'harvard', 'designer',
].map((id) => TEMPLATES.find((tpl) => tpl.id === id)!);
