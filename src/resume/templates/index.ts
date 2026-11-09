// Copied from the app (src/resume/templates/index.ts), plus the web's 50 more (./more.ts) after the app's 50.
// The 50 resume templates (design/Tpl*.dc.html), each = layout + header + heading style + fonts + accent + skills style
// + section order, as in reference/resume_templates_reference.py. render(resume) returns a complete HTML document for
// an A4 or Letter page; it flows onto more pages when the resume is long.
import { BUILT_IN_SECTIONS, type FontChoice, type Resume, type SectionKey } from '../types';
import type { CreateOptions } from '../store';
import type { PersonaId } from '../sampleData';
import { documentHtml } from './document';
import { renderPage } from './layouts';
import type { Heading, SkillsStyle } from './parts';
import { ARIAL, BASKERVILLE, DM, JAKARTA, LORA, MONO, PLAYFAIR, POPPINS, SERIF } from './fonts';
import { MORE_TEMPLATES } from './more';

export { FONT_STACKS } from './fonts';

export type TemplateGroup = 'ATS-friendly' | 'Professional' | 'Modern' | 'Creative' | 'Student';
export type FilterChip = 'All' | TemplateGroup;
/** single, sidebar, block (dark header), gov (Pakistan CV); stripe (accent stripe on the left), twocol (two columns
 *  under the header), cards (sections in cards), dates (section titles in a left column), banner (photo banner). */
export type Layout = 'single' | 'sidebar' | 'block' | 'gov' | 'stripe' | 'twocol' | 'cards' | 'dates' | 'banner';
export type HeaderStyle = 'left' | 'minimal' | 'center' | 'split' | 'big' | 'bar' | 'icons' | 'magazine';

/** The gallery's filter chips, in order (design/ResumeTemplates.dc.html). */
export const FILTER_CHIPS: FilterChip[] = ['All', 'ATS-friendly', 'Professional', 'Modern', 'Creative', 'Student'];

export type TemplateConfig = {
  id: string;
  name: string;
  group: TemplateGroup;
  /** The sample persona its design page shows. */
  persona: PersonaId;
  layout: Layout;
  header?: HeaderStyle;
  h: Heading;
  /** The template's own body font; it's what the design's Sans / Serif / Modern choice of its kind gives. */
  font: string;
  fontKind: FontChoice;
  /** A display font for the name and headings (Banker, Designer). */
  hfont?: string;
  accent: string;
  skills: SkillsStyle;
  timeline?: boolean;
  /** Main column (single: everything) in order. */
  order: SectionKey[];
  /** Sidebar (or the header block's right column), in order; 'contact' is the contact details. */
  sideOrder?: (SectionKey | 'contact')[];
  side?: 'left' | 'right';
  sidebarBg?: string;
  sidebarDark?: boolean;
  /** A photo circle by default (sidebar, block and banner layouts). */
  photo?: boolean;
  /** Smaller type and spacing (Compact). */
  dense?: boolean;
  /** Job dates in a column left of each job (Dates left). */
  datesLeft?: boolean;
  /** The block layout's header colour (Color block); dark grey by default. */
  blockBg?: string;
  /** The banner layout on dark grey (Studio); a light tint of the accent by default. */
  bannerDark?: boolean;
};

export const TEMPLATES: TemplateConfig[] = [
  { id: 'classic', name: 'Classic', group: 'ATS-friendly', persona: 'finance', layout: 'single', header: 'left', h: 'caps-rule', font: SERIF, fontKind: 'serif', accent: '#111827', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'certifications', 'languages'] },
  { id: 'clean-ats', name: 'Clean ATS', group: 'ATS-friendly', persona: 'software', layout: 'single', header: 'left', h: 'rule-accent', font: DM, fontKind: 'sans', accent: '#2563EB', skills: 'comma', order: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications'] },
  { id: 'minimal', name: 'Minimal', group: 'ATS-friendly', persona: 'finance', layout: 'single', header: 'minimal', h: 'small-caps', font: DM, fontKind: 'sans', accent: '#6B7280', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'languages'] },
  { id: 'executive', name: 'Executive', group: 'Professional', persona: 'finance', layout: 'single', header: 'center', h: 'double', font: LORA, fontKind: 'serif', accent: '#1E3A8A', skills: 'columns', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'corporate', name: 'Corporate', group: 'Professional', persona: 'finance', layout: 'sidebar', side: 'left', sidebarBg: '#F1F5F9', sidebarDark: false, photo: false, header: 'left', h: 'caps-rule', font: DM, fontKind: 'sans', accent: '#0F766E', skills: 'list', order: ['summary', 'experience', 'education'], sideOrder: ['contact', 'skills', 'certifications', 'languages'] },
  { id: 'banker', name: 'Banker', group: 'Professional', persona: 'finance', layout: 'single', header: 'split', h: 'bar', font: SERIF, fontKind: 'serif', hfont: DM, accent: '#7F1D1D', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'modern-sidebar', name: 'Modern sidebar', group: 'Modern', persona: 'software', layout: 'sidebar', side: 'left', sidebarBg: '#312E81', sidebarDark: true, photo: true, header: 'left', h: 'underline', font: JAKARTA, fontKind: 'modern', accent: '#4F46E5', skills: 'bars', order: ['summary', 'experience', 'projects', 'education'], sideOrder: ['contact', 'skills', 'languages', 'certifications'] },
  { id: 'timeline', name: 'Timeline', group: 'Modern', persona: 'software', layout: 'single', header: 'left', h: 'underline', font: JAKARTA, fontKind: 'modern', accent: '#4F46E5', skills: 'tags', timeline: true, order: ['summary', 'experience', 'education', 'skills', 'projects'] },
  { id: 'accent-bar', name: 'Accent bar', group: 'Modern', persona: 'software', layout: 'single', header: 'bar', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#0284C7', skills: 'tags', order: ['summary', 'experience', 'skills', 'education', 'projects'] },
  { id: 'bold-header', name: 'Bold header', group: 'Creative', persona: 'designer', layout: 'block', h: 'underline', font: POPPINS, fontKind: 'modern', accent: '#E5533D', skills: 'tags', photo: true, order: ['experience', 'education'], sideOrder: ['summary', 'skills', 'languages', 'achievements'] },
  { id: 'designer', name: 'Designer', group: 'Creative', persona: 'designer', layout: 'sidebar', side: 'right', sidebarBg: '#FDF2F8', sidebarDark: false, photo: true, header: 'left', h: 'small-caps', font: DM, fontKind: 'sans', hfont: PLAYFAIR, accent: '#BE185D', skills: 'tags', order: ['summary', 'experience', 'education'], sideOrder: ['contact', 'skills', 'languages', 'achievements'] },
  { id: 'bold-name', name: 'Bold name', group: 'Creative', persona: 'designer', layout: 'single', header: 'big', h: 'caps-rule', font: POPPINS, fontKind: 'modern', accent: '#D97706', skills: 'tags', order: ['summary', 'experience', 'education', 'skills', 'achievements'] },
  { id: 'fresher', name: 'Fresher', group: 'Student', persona: 'student', layout: 'single', header: 'left', h: 'rule-accent', font: JAKARTA, fontKind: 'modern', accent: '#059669', skills: 'tags', order: ['summary', 'education', 'projects', 'experience', 'skills', 'achievements'] },
  { id: 'internship', name: 'Internship', group: 'Student', persona: 'student', layout: 'sidebar', side: 'left', sidebarBg: '#EEF2FF', sidebarDark: false, photo: true, header: 'left', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#4F46E5', skills: 'list', order: ['summary', 'education', 'projects', 'experience'], sideOrder: ['contact', 'skills', 'achievements', 'languages'] },
  { id: 'academic', name: 'Academic CV', group: 'Student', persona: 'academic', layout: 'single', header: 'center', h: 'caps-rule', font: SERIF, fontKind: 'serif', accent: '#111827', skills: 'comma', order: ['summary', 'education', 'experience', 'publications', 'skills'] },
  { id: 'pakistan-gov', name: 'Pakistan government CV', group: 'ATS-friendly', persona: 'government', layout: 'gov', h: 'gov', font: SERIF, fontKind: 'serif', accent: '#14532D', skills: 'list', photo: true, order: ['summary', 'education', 'experience', 'skills', 'languages'] },
  // ---- the 50-template pack: 6 + 7 + 7 + 7 + 7 more, 10 per group ----
  { id: 'harvard', name: 'Harvard', group: 'ATS-friendly', persona: 'consultant', layout: 'single', header: 'center', h: 'caps-rule', font: BASKERVILLE, fontKind: 'serif', accent: '#111827', skills: 'comma', order: ['education', 'experience', 'skills', 'certifications', 'languages'] },
  { id: 'compact', name: 'Compact', group: 'ATS-friendly', persona: 'director', layout: 'single', header: 'left', h: 'rule-accent', font: DM, fontKind: 'sans', accent: '#334155', skills: 'comma', dense: true, order: ['summary', 'experience', 'education', 'skills', 'achievements', 'languages'] },
  { id: 'skills-first', name: 'Skills first', group: 'ATS-friendly', persona: 'software', layout: 'single', header: 'left', h: 'right-rule', font: DM, fontKind: 'sans', accent: '#0F766E', skills: 'columns', order: ['summary', 'skills', 'projects', 'experience', 'education'] },
  { id: 'chronological', name: 'Chronological', group: 'ATS-friendly', persona: 'manager', layout: 'single', header: 'split', h: 'caps-rule', font: SERIF, fontKind: 'serif', accent: '#1F2937', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'simple-serif', name: 'Simple serif', group: 'ATS-friendly', persona: 'engineer', layout: 'single', header: 'minimal', h: 'serif-italic', font: LORA, fontKind: 'serif', accent: '#374151', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'plain', name: 'Plain', group: 'ATS-friendly', persona: 'first-job', layout: 'single', header: 'left', h: 'plain', font: ARIAL, fontKind: 'sans', accent: '#111827', skills: 'comma', order: ['summary', 'education', 'experience', 'skills', 'achievements', 'languages'] },
  { id: 'consultant', name: 'Consultant', group: 'Professional', persona: 'consultant', layout: 'dates', header: 'left', h: 'small-caps', font: DM, fontKind: 'sans', accent: '#1E40AF', skills: 'comma', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'manager', name: 'Manager', group: 'Professional', persona: 'manager', layout: 'twocol', header: 'bar', h: 'bar', font: JAKARTA, fontKind: 'modern', accent: '#0369A1', skills: 'list', order: ['summary', 'experience'], sideOrder: ['skills', 'education', 'certifications', 'languages'] },
  { id: 'director', name: 'Director', group: 'Professional', persona: 'director', layout: 'single', header: 'center', h: 'double', font: BASKERVILLE, fontKind: 'serif', accent: '#78350F', skills: 'columns', order: ['summary', 'experience', 'achievements', 'education', 'skills'] },
  { id: 'lawyer', name: 'Lawyer', group: 'Professional', persona: 'lawyer', layout: 'single', header: 'split', h: 'caps-rule', font: BASKERVILLE, fontKind: 'serif', accent: '#1E3A8A', skills: 'columns', order: ['summary', 'experience', 'education', 'skills', 'certifications', 'languages'] },
  { id: 'doctor', name: 'Doctor', group: 'Professional', persona: 'doctor', layout: 'stripe', header: 'left', h: 'rule-accent', font: DM, fontKind: 'sans', accent: '#0E7490', skills: 'tags', order: ['summary', 'experience', 'education', 'certifications', 'skills', 'languages'] },
  { id: 'engineer', name: 'Engineer', group: 'Professional', persona: 'engineer', layout: 'sidebar', side: 'left', sidebarBg: '#F8FAFC', sidebarDark: false, photo: false, header: 'left', h: 'block', font: JAKARTA, fontKind: 'modern', accent: '#B45309', skills: 'bars', order: ['summary', 'experience', 'education'], sideOrder: ['contact', 'skills', 'certifications', 'languages'] },
  { id: 'teacher', name: 'Teacher', group: 'Professional', persona: 'teacher', layout: 'cards', header: 'center', h: 'underline', font: JAKARTA, fontKind: 'modern', accent: '#16A34A', skills: 'tags', order: ['summary', 'experience', 'education', 'skills', 'achievements'] },
  { id: 'split-column', name: 'Split column', group: 'Modern', persona: 'software', layout: 'twocol', header: 'left', h: 'right-rule', font: JAKARTA, fontKind: 'modern', accent: '#7C3AED', skills: 'tags', order: ['summary', 'experience', 'education'], sideOrder: ['skills', 'projects', 'certifications', 'languages'] },
  { id: 'cards', name: 'Cards', group: 'Modern', persona: 'marketing', layout: 'cards', header: 'bar', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#DB2777', skills: 'tags', order: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications'] },
  { id: 'icon-contact', name: 'Icon contact', group: 'Modern', persona: 'manager', layout: 'single', header: 'icons', h: 'underline', font: JAKARTA, fontKind: 'modern', accent: '#0891B2', skills: 'tags', order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'dates-left', name: 'Dates left', group: 'Modern', persona: 'consultant', layout: 'single', header: 'left', h: 'right-rule', font: DM, fontKind: 'sans', accent: '#4F46E5', skills: 'tags', datesLeft: true, order: ['summary', 'experience', 'education', 'skills', 'certifications'] },
  { id: 'mono', name: 'Mono', group: 'Modern', persona: 'graduate', layout: 'single', header: 'minimal', h: 'small-caps', font: MONO, fontKind: 'modern', accent: '#111827', skills: 'comma', order: ['summary', 'projects', 'experience', 'education', 'skills'] },
  { id: 'tech', name: 'Tech', group: 'Modern', persona: 'software', layout: 'single', header: 'left', h: 'code', font: DM, fontKind: 'sans', hfont: MONO, accent: '#059669', skills: 'tags', order: ['summary', 'skills', 'experience', 'projects', 'education'] },
  { id: 'clean-grid', name: 'Clean grid', group: 'Modern', persona: 'graduate', layout: 'twocol', header: 'split', h: 'small-caps', font: DM, fontKind: 'sans', accent: '#2563EB', skills: 'list', order: ['summary', 'projects', 'experience'], sideOrder: ['education', 'skills', 'languages'] },
  { id: 'magazine', name: 'Magazine', group: 'Creative', persona: 'designer', layout: 'twocol', header: 'magazine', h: 'serif-italic', font: DM, fontKind: 'sans', hfont: PLAYFAIR, accent: '#9F1239', skills: 'list', order: ['summary', 'experience'], sideOrder: ['education', 'skills', 'achievements', 'languages'] },
  { id: 'color-block', name: 'Color block', group: 'Creative', persona: 'marketing', layout: 'block', h: 'underline', font: POPPINS, fontKind: 'modern', accent: '#DB2777', skills: 'tags', blockBg: '#DB2777', photo: true, order: ['experience', 'projects', 'education'], sideOrder: ['summary', 'skills', 'certifications', 'languages'] },
  { id: 'portfolio', name: 'Portfolio', group: 'Creative', persona: 'artist', layout: 'twocol', header: 'big', h: 'caps-rule', font: POPPINS, fontKind: 'modern', accent: '#EA580C', skills: 'tags', order: ['summary', 'projects', 'experience'], sideOrder: ['education', 'skills', 'achievements', 'languages'] },
  { id: 'photo-banner', name: 'Photo banner', group: 'Creative', persona: 'designer', layout: 'banner', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#4F46E5', skills: 'tags', photo: true, order: ['summary', 'experience', 'education'], sideOrder: ['skills', 'languages', 'achievements'] },
  { id: 'marketing', name: 'Marketing', group: 'Creative', persona: 'marketing', layout: 'stripe', header: 'big', h: 'block', font: POPPINS, fontKind: 'modern', accent: '#F97316', skills: 'tags', order: ['summary', 'experience', 'projects', 'skills', 'certifications'] },
  { id: 'artist', name: 'Artist', group: 'Creative', persona: 'artist', layout: 'sidebar', side: 'left', sidebarBg: '#FFF7ED', sidebarDark: false, photo: true, header: 'left', h: 'serif-italic', font: DM, fontKind: 'sans', hfont: PLAYFAIR, accent: '#C2410C', skills: 'list', order: ['summary', 'projects', 'experience', 'education'], sideOrder: ['contact', 'skills', 'achievements', 'languages'] },
  { id: 'studio', name: 'Studio', group: 'Creative', persona: 'designer', layout: 'banner', h: 'right-rule', font: POPPINS, fontKind: 'modern', accent: '#14B8A6', skills: 'tags', bannerDark: true, photo: true, order: ['summary', 'experience', 'education'], sideOrder: ['skills', 'achievements', 'languages'] },
  { id: 'school-leaver', name: 'School leaver', group: 'Student', persona: 'school-leaver', layout: 'single', header: 'left', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#0D9488', skills: 'tags', order: ['summary', 'education', 'achievements', 'experience', 'skills', 'languages'] },
  { id: 'scholarship', name: 'Scholarship CV', group: 'Student', persona: 'scholarship', layout: 'cards', header: 'left', h: 'rule-accent', font: JAKARTA, fontKind: 'modern', accent: '#4F46E5', skills: 'tags', order: ['summary', 'education', 'achievements', 'experience', 'skills', 'languages'] },
  { id: 'first-job', name: 'First job', group: 'Student', persona: 'first-job', layout: 'twocol', header: 'bar', h: 'underline', font: POPPINS, fontKind: 'modern', accent: '#E11D48', skills: 'list', order: ['summary', 'education', 'experience'], sideOrder: ['skills', 'achievements', 'languages'] },
  { id: 'graduate', name: 'Graduate', group: 'Student', persona: 'graduate', layout: 'dates', header: 'left', h: 'small-caps', font: DM, fontKind: 'sans', accent: '#2563EB', skills: 'comma', order: ['summary', 'education', 'projects', 'experience', 'skills'] },
  { id: 'research-assistant', name: 'Research assistant', group: 'Student', persona: 'research-assistant', layout: 'single', header: 'center', h: 'right-rule', font: SERIF, fontKind: 'serif', accent: '#166534', skills: 'comma', order: ['summary', 'education', 'experience', 'publications', 'skills'] },
  { id: 'volunteer', name: 'Volunteer', group: 'Student', persona: 'volunteer', layout: 'stripe', header: 'left', h: 'pill', font: JAKARTA, fontKind: 'modern', accent: '#DC2626', skills: 'tags', order: ['summary', 'volunteering', 'education', 'experience', 'skills', 'languages'] },
  { id: 'teaching-assistant', name: 'Teaching assistant', group: 'Student', persona: 'teaching-assistant', layout: 'sidebar', side: 'right', sidebarBg: '#F0F9FF', sidebarDark: false, photo: true, header: 'left', h: 'bar', font: JAKARTA, fontKind: 'modern', accent: '#0369A1', skills: 'list', order: ['summary', 'experience', 'education'], sideOrder: ['contact', 'skills', 'achievements', 'languages'] },
];

// the web's 50 more after the app's 50 (./more.ts)
TEMPLATES.push(...MORE_TEMPLATES);

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export const getTemplate = (id: string): TemplateConfig => BY_ID.get(id) ?? TEMPLATES[0];

/** Templates under a filter chip ("All" = every template). */
export const templatesFor = (chip: FilterChip) => (chip === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.group === chip));

/** The chips a template appears under. */
export const chipsOf = (t: TemplateConfig): FilterChip[] => ['All', t.group];

/** The small badge on a gallery card: "ATS" for ATS-friendly, otherwise the group. */
export const badgeOf = (t: TemplateConfig) => (t.group === 'ATS-friendly' ? 'ATS' : t.group);

/** The sections a new resume on this template shows, in the template's order (the rest can be added). */
export function defaultSections(t: TemplateConfig): SectionKey[] {
  const keys = [...t.order, ...(t.sideOrder ?? [])].filter((k): k is SectionKey => k !== 'contact');
  return keys.filter((k, i) => keys.indexOf(k) === i);
}

/** What useResumes.create() needs to start a resume on this template: its look and its sections. */
export function createOptions(t: TemplateConfig): CreateOptions {
  const sectionOrder = defaultSections(t);
  return {
    design: { accent: t.accent, font: t.fontKind, spacing: 'normal', pageSize: 'A4', showPhoto: !!t.photo },
    sectionOrder,
    hiddenSections: BUILT_IN_SECTIONS.filter((k) => !sectionOrder.includes(k)),
  };
}

/** The resume as a complete HTML document (A4 or Letter, one or more pages), ready for the WebView or PDF. */
export function render(resume: Resume, opts?: { fontBase?: string }): string {
  const t = getTemplate(resume.templateId);
  return documentHtml(resume, t, renderPage(resume, t), opts?.fontBase);
}

export { renderPage };
