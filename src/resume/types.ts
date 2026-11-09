// Resume builder data model (docs/RESUME_PLAN.md R2). Field names follow the sample personas in
// reference/resume_templates_reference.py; list entries carry an `id` so they can be reordered and edited by key.
// Dates are '2021' (year) or '2025-06' (month); `current` means "Present" ("I work / study here now").

export type FontChoice = 'sans' | 'serif' | 'modern';
export type Spacing = 'compact' | 'normal' | 'roomy';
export type PageSize = 'A4' | 'Letter';

export type ResumeDesign = {
  /** '#RRGGBB' */
  accent: string;
  font: FontChoice;
  spacing: Spacing;
  pageSize: PageSize;
  showPhoto: boolean;
};

export type Personal = {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  city: string;
  /** LinkedIn, GitHub, Behance, ORCID... */
  link: string;
  photoUri?: string;
  // Pakistan CV fields (the government CV template), all optional
  fatherName?: string;
  cnic?: string;
  dateOfBirth?: string;
  domicile?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
};

export type Experience = {
  id: string;
  role: string;
  company: string;
  city: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
};

export type Education = {
  id: string;
  degree: string;
  /** School, university or board, as written ("University of the Punjab, Lahore", "BISE Multan"). */
  school: string;
  start: string;
  end: string;
  current: boolean;
  /** CGPA, marks, thesis, honours. */
  details: string;
};

export type Project = { id: string; name: string; description: string; link?: string };

export type CustomSection = { id: string; title: string; bullets: string[] };

/** Sections the person can reorder or hide. Personal details is always first and isn't one of these. */
export type BuiltInSection =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'achievements'
  | 'publications'
  | 'volunteering';

/** A built-in section, or `custom:<id>` for one of customSections. */
export type SectionKey = BuiltInSection | `custom:${string}`;

/** Everything the person writes (what the sample personas fill in). */
export type ResumeContent = {
  personal: Personal;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: string[];
  languages: string[];
  achievements: string[];
  publications: string[];
  /** "Flood relief coordinator, Alkhidmat, 2022: ..." one line each (the Volunteer template). */
  volunteering: string[];
  customSections: CustomSection[];
};

export type Resume = ResumeContent & {
  id: string;
  title: string;
  templateId: string;
  design: ResumeDesign;
  /** Order of the sections after Personal details. */
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  createdAt: number;
  updatedAt: number;
};

export const BUILT_IN_SECTIONS: BuiltInSection[] = [
  'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'achievements', 'publications',
  'volunteering',
];

export const customKey = (id: string): SectionKey => `custom:${id}`;
export const isCustomKey = (k: SectionKey): k is `custom:${string}` => k.startsWith('custom:');

export const emptyPersonal = (): Personal => ({ fullName: '', jobTitle: '', email: '', phone: '', city: '', link: '' });

export const emptyContent = (): ResumeContent => ({
  personal: emptyPersonal(),
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  achievements: [],
  publications: [],
  volunteering: [],
  customSections: [],
});

/** Short unique id for resumes and entries. */
export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
