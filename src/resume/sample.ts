// A template's sample resume (the app's scripts/lib/resume-templates.js sample): its persona's content with the
// template's own design and sections. The gallery thumbnails and the preview use it.
import { samplePersona } from './sampleData';
import { createOptions, type TemplateConfig } from './templates';
import type { Resume, ResumeDesign } from './types';

export function sampleResume(t: TemplateConfig, design: Partial<ResumeDesign> = {}): Resume {
  const o = createOptions(t);
  return {
    ...samplePersona(t.persona),
    id: 'sample',
    title: t.name,
    templateId: t.id,
    design: { ...o.design!, ...design } as ResumeDesign,
    sectionOrder: o.sectionOrder!,
    hiddenSections: o.hiddenSections!,
    createdAt: 0,
    updatedAt: 0,
  };
}
