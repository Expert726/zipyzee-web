// Shared pieces of every template, ported from reference/resume_templates_reference.py: the 12 heading styles, the
// section renderers, the photo circle and the name block. The markup is the reference's, character for character, so
// a template with default settings matches its design/Tpl*.dc.html page exactly (see __tests__/resumeTemplates).
import type { Education, Experience, Project, Resume } from '../types';
import { contactList, esc, escAttr, formatDates, initials, tint } from './format';

export type Heading =
  | 'caps-rule' | 'rule-accent' | 'small-caps' | 'double' | 'bar' | 'pill' | 'underline'
  | 'right-rule' | 'serif-italic' | 'code' | 'block' | 'plain' | 'gov';
export type SkillsStyle = 'comma' | 'tags' | 'columns' | 'bars' | 'list';

/** What a template draws with, after the resume's design choices are applied. */
export type Ctx = {
  accent: string;
  /** Body font stack. */
  font: string;
  /** Name and heading font stack (a template's display font), or the body font. */
  hfont: string;
  h: Heading;
  skills: SkillsStyle;
  timeline: boolean;
  /** Spacing factor: 1 = the board (Normal), smaller for Compact, larger for Roomy. */
  k: number;
  /** Smaller type and tighter sections (Compact template). */
  dense?: boolean;
  /** Every section in a light card (Cards layout). */
  cards?: boolean;
  /** Job dates in a column on the left (Dates left). */
  datesLeft?: boolean;
};

/** A spacing value: the board's px at Normal, scaled for Compact / Roomy. */
export const sp = (c: Ctx, n: number) => `${c.k === 1 ? n : Math.round(n * c.k * 10) / 10}px`;

/** Section titles as the templates print them (the reference's TITLES). The resume itself is in English. */
export const TITLES: Record<string, string> = {
  summary: 'Profile', experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects',
  certifications: 'Certifications', languages: 'Languages', achievements: 'Achievements', publications: 'Publications', contact: 'Contact',
  volunteering: 'Volunteering',
};

export function head(title: string, c: Ctx, dark = false): string {
  const a = c.accent;
  const hf = c.hfont;
  const col = dark ? '#FFFFFF' : a;
  const t = esc(title);
  switch (c.h) {
    case 'caps-rule':
      return `<h2 style="margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid ${dark ? '#FFFFFF55' : '#D1D5DB'}; font-family: ${hf}; font-size: 10.5px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: 700; color: ${col}">${t}</h2>`;
    case 'rule-accent':
      return `<h2 style="margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid ${a}; font-family: ${hf}; font-size: 12px; font-weight: 700; color: ${dark ? '#FFFFFF' : '#111827'}">${t}</h2>`;
    case 'small-caps':
      return `<h2 style="margin: 0 0 8px; font-family: ${hf}; font-size: 9px; letter-spacing: 2.4px; text-transform: uppercase; font-weight: 600; color: ${dark ? '#FFFFFFCC' : '#6B7280'}">${t}</h2>`;
    case 'double':
      return `<h2 style="margin: 0 0 8px; padding: 3px 0; border-top: 1px solid ${a}; border-bottom: 1px solid ${a}; text-align: center; font-family: ${hf}; font-size: 10.5px; letter-spacing: 2px; text-transform: uppercase; font-weight: 700; color: ${a}">${t}</h2>`;
    case 'bar':
      return `<h2 style="margin: 0 0 8px; padding-left: 8px; border-left: 4px solid ${a}; font-family: ${hf}; font-size: 12px; font-weight: 700; color: #111827">${t}</h2>`;
    case 'pill':
      return `<h2 style="margin: 0 0 8px"><span style="display: inline-block; padding: 3px 10px; border-radius: 999px; background: ${tint(a)}; font-family: ${hf}; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 700; color: ${a}">${t}</span></h2>`;
    case 'underline':
      return (
        `<h2 style="margin: 0 0 9px; font-family: ${hf}; font-size: 12.5px; font-weight: 700; color: ${dark ? '#FFFFFF' : '#111827'}">${t}` +
        `<span style="display: block; width: 26px; height: 3px; margin-top: 4px; border-radius: 2px; background: ${dark ? '#FFFFFF' : a}"></span></h2>`
      );
    case 'right-rule':
      return (
        `<h2 style="margin: 0 0 8px; display: flex; align-items: center; gap: 8px; font-family: ${hf}; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; color: ${col}">` +
        `${t}<span style="flex: 1; height: 1px; background: ${dark ? '#FFFFFF55' : tint(a, '55')}"></span></h2>`
      );
    case 'serif-italic':
      return `<h2 style="margin: 0 0 7px; font-family: ${hf}; font-style: italic; font-size: 15px; font-weight: 700; color: ${dark ? '#FFFFFF' : a}">${t}</h2>`;
    case 'code':
      return `<h2 style="margin: 0 0 8px; font-family: ${hf}; font-size: 11.5px; font-weight: 600; color: ${a}">// ${esc(title.toLowerCase())}</h2>`;
    case 'block':
      return `<h2 style="margin: 0 0 8px; padding: 4px 8px; background: ${a}; color: #FFFFFF; font-family: ${hf}; font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 700">${t}</h2>`;
    case 'plain':
      return `<h2 style="margin: 0 0 6px; font-family: ${hf}; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #111827">${t}</h2>`;
    default:
      return `<h2 style="margin: 0 0 6px; font-size: 12px; font-weight: 700">${t}</h2>`;
  }
}

export const pText = (s: string, dark = false) => `<p style="margin: 0; color: ${dark ? '#E0E7FF' : '#374151'}">${esc(s)}</p>`;

/** "Nova Retail Group, Lahore" (or just one of them). */
const place = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).map(esc).join(', ');

export function expHtml(items: Experience[], c: Ctx): string {
  return items
    .map((x) => {
      const bullets = x.bullets.filter((b) => b.trim());
      const bl = bullets.map((b) => `<li style="margin: 1px 0">${esc(b)}</li>`).join('');
      const org = place(x.company, x.city);
      const dates = esc(formatDates(x.start, x.end, x.current));
      // with dates on the left, the dates leave the title row
      const datesInRow = c.datesLeft ? '' : `<span style="flex-shrink: 0; font-size: 9.5px; color: #6B7280">${dates}</span>`;
      const body =
        `<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-weight: 700; color: #111827">${esc(x.role)}</span>` +
        `${datesInRow}</div>` +
        (org ? `<div style="font-size: 10px; color: ${c.accent !== '#111827' ? c.accent : '#4B5563'}; font-weight: 600">${org}</div>` : '') +
        (bl ? `<ul style="margin: 3px 0 0; padding-left: 14px; color: #374151">${bl}</ul>` : '');
      if (c.datesLeft) {
        return (
          `<div style="display: flex; gap: 14px; margin-bottom: ${sp(c, 9)}"><div style="width: 82px; flex-shrink: 0; font-size: 9.5px; font-weight: 700; color: ${c.accent}">${dates}</div>` +
          `<div style="flex: 1; min-width: 0">${body}</div></div>`
        );
      }
      if (c.timeline) {
        return (
          `<div style="position: relative; padding-left: 18px; padding-bottom: ${sp(c, 8)}; border-left: 2px solid ${tint(c.accent, '40')}; margin-left: 4px">` +
          `<span style="position: absolute; left: -6px; top: 2px; width: 10px; height: 10px; border-radius: 5px; background: ${c.accent}"></span>${body}</div>`
        );
      }
      return `<div style="margin-bottom: ${sp(c, 9)}">${body}</div>`;
    })
    .join('');
}

export function eduHtml(items: Education[], c: Ctx, dark = false): string {
  const tc = dark ? '#FFFFFF' : '#111827';
  const mc = dark ? '#C7D2FE' : '#6B7280';
  return items
    .map(
      (x) =>
        `<div style="margin-bottom: ${sp(c, 7)}"><div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-weight: 700; color: ${tc}">${esc(x.degree)}</span>` +
        `<span style="flex-shrink: 0; font-size: 9.5px; color: ${mc}">${esc(formatDates(x.start, x.end, x.current))}</span></div>` +
        (x.school.trim() ? `<div style="color: ${dark ? '#E0E7FF' : '#374151'}">${esc(x.school)}</div>` : '') +
        // always there, like the reference (an empty line has no height)
        `<div style="font-size: 9.5px; color: ${mc}">${esc(x.details.trim())}</div>` +
        '</div>',
    )
    .join('');
}

/** Decorative levels for the "bars" skills style (skills have no level of their own). */
const LEVELS = [92, 85, 80, 70, 75, 88];

export function skillsHtml(skills: string[], c: Ctx, dark = false): string {
  switch (c.skills) {
    case 'tags':
      return (
        '<div style="display: flex; flex-wrap: wrap; gap: 5px">' +
        skills
          .map(
            (s) =>
              `<span style="padding: 2px 8px; border-radius: 4px; background: ${dark ? '#FFFFFF26' : tint(c.accent, '1A')}; color: ${dark ? '#FFFFFF' : c.accent}; font-size: 9.5px; font-weight: 600">${esc(s)}</span>`,
          )
          .join('') +
        '</div>'
      );
    case 'comma':
      return pText(skills.join(', '), dark);
    case 'columns':
      return (
        '<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px 12px; color: #374151">' +
        skills.map((s) => `<span>• ${esc(s)}</span>`).join('') +
        '</div>'
      );
    case 'bars':
      return skills
        .map(
          (s, i) =>
            `<div style="margin-bottom: 6px"><div style="font-size: 9.5px; color: ${dark ? '#E0E7FF' : '#374151'}; margin-bottom: 2px">${esc(s)}</div>` +
            `<div style="height: 4px; border-radius: 2px; background: ${dark ? '#FFFFFF33' : '#E5E7EB'}"><div style="width: ${LEVELS[i % 6]}%; height: 100%; border-radius: 2px; background: ${dark ? '#A5B4FC' : c.accent}"></div></div></div>`,
        )
        .join('');
    default:
      return listHtml(skills, dark);
  }
}

export const listHtml = (items: string[], dark = false) =>
  items.map((s) => `<div style="margin-bottom: 3px; color: ${dark ? '#E0E7FF' : '#374151'}">• ${esc(s)}</div>`).join('');

export const projHtml = (items: Project[], c: Ctx, dark = false) =>
  items
    .map(
      (x) =>
        `<div style="margin-bottom: ${sp(c, 6)}"><span style="font-weight: 700; color: ${dark ? '#FFFFFF' : '#111827'}">${esc(x.name)}.</span> <span style="color: #374151">${esc(x.description)}</span></div>`,
    )
    .join('');

export function contactHtml(r: Resume, dark = false, stacked = true): string {
  const col = dark ? '#E0E7FF' : '#374151';
  const items = contactList(r.personal);
  if (stacked) return items.map((x) => `<div style="margin-bottom: 4px; color: ${col}; word-break: break-word">${esc(x)}</div>`).join('');
  return `<div style="display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 9.5px; color: ${col}">` + items.map((x) => `<span>${esc(x)}</span>`).join('') + '</div>';
}

/** Whether a section has anything to print (empty sections are skipped). */
export function hasContent(r: Resume, key: string): boolean {
  switch (key) {
    case 'contact':
      return contactList(r.personal).length > 0;
    case 'summary':
      return !!r.summary.trim();
    case 'experience':
    case 'education':
    case 'skills':
    case 'projects':
    case 'certifications':
    case 'languages':
    case 'achievements':
    case 'publications':
    case 'volunteering':
      return r[key].length > 0;
    default:
      return !!customOf(r, key)?.bullets.some((b) => b.trim());
  }
}

const customOf = (r: Resume, key: string) => (key.startsWith('custom:') ? r.customSections.find((s) => `custom:${s.id}` === key) : undefined);

/** A section's printed title (a custom section's own title). */
export const sectionTitle = (r: Resume, key: string) => (key.startsWith('custom:') ? customOf(r, key)?.title.trim() || 'More' : TITLES[key]);

/** One section: its heading and body, or '' when there's nothing in it. */
export function section(key: string, r: Resume, c: Ctx, dark = false): string {
  if (!hasContent(r, key)) return '';
  const inner = `${head(sectionTitle(r, key), c, dark)}${sectionBody(key, r, c, dark)}`;
  if (c.cards && !dark) {
    return `<section style="margin-bottom: ${sp(c, 10)}; padding: 11px 13px; border-radius: 8px; background: #F8FAFC; border: 1px solid #E2E8F0">${inner}</section>`;
  }
  return `<section style="margin-bottom: ${sp(c, c.dense ? 9 : 14)}">${inner}</section>`;
}

/** A section's content, without its heading. */
export function sectionBody(key: string, r: Resume, c: Ctx, dark = false): string {
  let body: string;
  switch (key) {
    case 'summary':
      body = pText(r.summary, dark);
      break;
    case 'experience':
      body = expHtml(r.experience, c);
      break;
    case 'education':
      body = eduHtml(r.education, c, dark);
      break;
    case 'skills':
      body = skillsHtml(r.skills, c, dark);
      break;
    case 'projects':
      body = projHtml(r.projects, c, dark);
      break;
    case 'publications':
      body = r.publications.map((x) => `<p style="margin: 0 0 6px; color: #374151">${esc(x)}</p>`).join('');
      break;
    case 'contact':
      body = contactHtml(r, dark);
      break;
    case 'certifications':
    case 'languages':
    case 'achievements':
    case 'volunteering':
      body = listHtml(r[key], dark);
      break;
    default:
      body = listHtml((customOf(r, key)?.bullets ?? []).filter((b) => b.trim()), dark);
  }
  return body;
}

/** The photo circle: the person's photo when there is one, otherwise their initials (as on the boards). */
export function photo(r: Resume, size: number, ring: string, bg: string, fg: string): string {
  const box = `width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid ${ring}`;
  if (r.personal.photoUri) {
    return `<img src="${escAttr(r.personal.photoUri)}" alt="" style="${box}; box-sizing: border-box; object-fit: cover; flex-shrink: 0">`;
  }
  return (
    `<div style="${box}; background: ${bg}; color: ${fg}; display: flex; ` +
    `align-items: center; justify-content: center; font-size: ${Math.floor(size * 0.32)}px; font-weight: 700; flex-shrink: 0">${esc(initials(r.personal.fullName))}</div>`
  );
}

export function nameBlock(r: Resume, c: Ctx, align = 'left', size = 26, dark = false): string {
  const title = r.personal.jobTitle.trim();
  return (
    `<div style="text-align: ${align}"><div style="font-family: ${c.hfont}; font-size: ${size}px; line-height: 1.1; font-weight: 800; letter-spacing: -0.4px; color: ${dark ? '#FFFFFF' : '#111827'}">${esc(r.personal.fullName)}</div>` +
    (title ? `<div style="margin-top: 4px; font-size: 12px; font-weight: 600; color: ${dark ? '#E0E7FF' : c.accent}">${esc(title)}</div>` : '') +
    '</div>'
  );
}
