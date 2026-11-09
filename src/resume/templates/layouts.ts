// The page layouts of reference/resume_templates_reference.py, driven by a template's config and the resume's design
// choices: single (8 header styles, make_header), cards, stripe, twocol, dates and banner; and the first engine's
// sidebar (left / right), header block and Pakistan government table CV, which the reference keeps as they were.
import type { Resume, SectionKey } from '../types';
import { FONT_STACKS } from './fonts';
import { esc, escAttr, shade, tint } from './format';
import { contactHtml, expHtml, hasContent, listHtml, nameBlock, photo, pText, section, sectionBody, sectionTitle, sp, type Ctx } from './parts';
import type { TemplateConfig } from './index';

export const PAGE_SIZES = { A4: { w: 595, h: 842 }, Letter: { w: 612, h: 792 } } as const;

const SPACING = { compact: { k: 0.75, lh: 1.35 }, normal: { k: 1, lh: 1.45 }, roomy: { k: 1.3, lh: 1.6 } } as const;

/** A page: its outer style and content (the content is the design's markup, character for character), plus what
 *  the document needs to carry the page onto more pages. */
export type Page = {
  style: string;
  inner: string;
  /** A sidebar's colour column, painted down every page. */
  sidebar?: { side: 'left' | 'right'; width: number; bg: string };
};

/** The template, adjusted by the resume's design choices (accent, font, spacing). Defaults = the template's board. */
export function contextOf(r: Resume, t: TemplateConfig): Ctx {
  const d = r.design;
  const font = d.font === t.fontKind ? t.font : FONT_STACKS[d.font];
  return {
    accent: d.accent || t.accent,
    font,
    hfont: t.hfont ?? font,
    h: t.h,
    skills: t.skills,
    timeline: !!t.timeline,
    k: SPACING[d.spacing]?.k ?? 1,
    dense: !!t.dense,
    cards: t.layout === 'cards',
    datesLeft: !!t.datesLeft,
  };
}

/** Line height: the spacing's, a little tighter for a dense template (1.36 at Normal, as on its board). */
const lineHeight = (r: Resume, t: TemplateConfig) => {
  const lh = SPACING[r.design.spacing]?.lh ?? 1.45;
  return t.dense ? Math.round((lh - 0.09) * 100) / 100 : lh;
};

/** The sections to print, in the person's order, without hidden or empty ones. */
const visible = (r: Resume) => r.sectionOrder.filter((k) => !r.hiddenSections.includes(k) && hasContent(r, k));

export function renderPage(r: Resume, t: TemplateConfig): Page {
  const c = contextOf(r, t);
  const a = c.accent;
  const size = PAGE_SIZES[r.design.pageSize] ?? PAGE_SIZES.A4;
  const lh = lineHeight(r, t);
  const base = `width: ${size.w}px; min-height: ${size.h - 1}px; box-sizing: border-box; background: #FFFFFF; font-family: ${c.font}; font-size: ${t.dense ? '9.6px' : '10.5px'}; line-height: ${lh}; color: #1F2937; position: relative`;
  const keys = visible(r);
  const sideKeys = new Set<string>((t.sideOrder ?? []).filter((k) => k !== 'contact'));
  const showPhoto = r.design.showPhoto;
  const changedAccent = a.toUpperCase() !== t.accent.toUpperCase();

  const sections = (list: string[]) => list.map((k) => section(k, r, c)).join('');
  const mainKeys = keys.filter((k) => !sideKeys.has(k));
  const asideKeys = keys.filter((k) => sideKeys.has(k));

  if (t.layout === 'single' || t.layout === 'cards') {
    return { style: `${base}; padding: ${t.dense ? '32px 38px' : '40px 44px'}`, inner: `${makeHeader(r, t, c)}${sections(keys)}` };
  }

  if (t.layout === 'stripe') {
    const stripes =
      `<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 16px; background: ${a}"></div>` +
      `<div style="position: absolute; left: 16px; top: 0; bottom: 0; width: 4px; background: ${tint(a, '4D')}"></div>`;
    return { style: `${base}; padding: 40px 44px 40px 60px`, inner: `${stripes}${makeHeader(r, t, c)}${sections(keys)}` };
  }

  if (t.layout === 'twocol') {
    return {
      style: `${base}; padding: 40px 40px`,
      inner:
        `${makeHeader(r, t, c)}<div style="display: flex; gap: 26px"><div style="flex: 1.35; min-width: 0">${sections(mainKeys)}</div>` +
        `<div style="flex: 1; min-width: 0; padding-left: 20px; border-left: 1px solid #E5E7EB">${sections(asideKeys)}</div></div>`,
    };
  }

  if (t.layout === 'dates') {
    // the section titles sit in a column on the left, the content on the right
    const rows = keys
      .map(
        (k) =>
          `<div style="display: flex; gap: 18px; margin-bottom: ${sp(c, 14)}; padding-top: 10px; border-top: 1px solid #E5E7EB"><div style="width: 92px; flex-shrink: 0; font-size: 9px; letter-spacing: 1.8px; ` +
          `text-transform: uppercase; font-weight: 700; color: ${a}">${esc(sectionTitle(r, k))}</div><div style="flex: 1; min-width: 0">${sectionBody(k, r, c)}</div></div>`,
      )
      .join('');
    return { style: `${base}; padding: 40px 44px`, inner: `${makeHeader(r, t, c)}${rows}` };
  }

  if (t.layout === 'banner') {
    const dark = !!t.bannerDark;
    const ph = showPhoto ? photo(r, 104, '#FFFFFF', dark ? a : '#FFFFFF', dark ? '#FFFFFF' : a) : '';
    const header =
      `<div style="height: 150px; background: ${dark ? '#111827' : tint(a, '1F')}; position: relative">` +
      (ph ? `<div style="position: absolute; left: 40px; bottom: -44px">${ph}</div>` : '') +
      `<div style="position: absolute; left: 164px; right: 40px; bottom: 20px">${nameBlock(r, c, 'left', 28, dark)}</div></div>` +
      `<div style="padding: 54px 40px 0 164px; margin-bottom: ${sp(c, 14)}">${contactHtml(r, false, false)}</div>`;
    return {
      style: base,
      inner:
        `${header}<div style="display: flex; gap: 26px; padding: 6px 40px"><div style="flex: 1.4; min-width: 0">${sections(mainKeys)}</div>` +
        `<div style="flex: 1; min-width: 0">${sections(asideKeys)}</div></div>`,
    };
  }

  if (t.layout === 'sidebar') {
    const dark = !!t.sidebarDark;
    const bg = !changedAccent ? t.sidebarBg! : dark ? shade(a, 0.55) : tint(a, '12');
    const ph = t.photo && showPhoto ? photo(r, 84, dark ? '#FFFFFF' : a, dark ? '#FFFFFF33' : tint(a, '26'), dark ? '#FFFFFF' : a) : '';
    const sideList = [
      ...((t.sideOrder ?? []).includes('contact') ? ['contact'] : []),
      ...keys.filter((k) => sideKeys.has(k)),
    ];
    const sideInner = (ph ? `<div style="display: flex; justify-content: center; margin-bottom: 18px">${ph}</div>` : '') + sideList.map((k) => section(k, r, c, dark)).join('');
    const side = `<aside style="width: 190px; flex-shrink: 0; box-sizing: border-box; padding: 34px 20px; background: ${bg}; color: ${dark ? '#FFFFFF' : '#1F2937'}">${sideInner}</aside>`;
    const main =
      `<main style="flex: 1; min-width: 0; padding: 38px 30px"><header style="margin-bottom: ${sp(c, 18)}">${nameBlock(r, c, 'left', 25)}</header>` +
      keys.filter((k) => !sideKeys.has(k)).map((k) => section(k, r, c)).join('') +
      '</main>';
    const side_ = t.side ?? 'left';
    return {
      style: `${base}; display: flex`,
      inner: side_ === 'left' ? side + main : main + side,
      sidebar: { side: side_, width: 190, bg },
    };
  }

  if (t.layout === 'block') {
    // Color block's header is its accent colour, so a new accent recolours it; the others stay dark grey
    const blockBg = t.blockBg ? (changedAccent ? a : t.blockBg) : '#111827';
    const ph = showPhoto ? photo(r, 76, a, '#FFFFFF1A', '#FFFFFF') : '';
    const header =
      `<header style="padding: 34px 40px 26px; background: ${blockBg}; display: flex; align-items: center; gap: 20px">${ph}` +
      `<div style="flex: 1">${nameBlock(r, c, 'left', 30, true)}<div style="margin-top: 8px">${contactHtml(r, true, false)}</div></div></header>` +
      `<div style="height: 6px; background: ${a}"></div>`;
    const left = keys.filter((k) => !sideKeys.has(k)).map((k) => section(k, r, c)).join('');
    const right = keys.filter((k) => sideKeys.has(k)).map((k) => section(k, r, c)).join('');
    return {
      style: base,
      inner: `${header}<div style="display: flex; gap: 24px; padding: 24px 40px"><div style="flex: 1.5; min-width: 0">${left}</div><div style="flex: 1; min-width: 0">${right}</div></div>`,
    };
  }

  return { style: `${base}; padding: 36px 44px`, inner: govPage(r, c, keys, changedAccent) };
}

/** The page header (the reference's make_header): name, job title and contact details in one of 8 styles. */
function makeHeader(r: Resume, t: TemplateConfig, c: Ctx): string {
  const p = r.personal;
  const a = c.accent;
  const contacts = contactHtml(r, false, false);
  switch (t.header) {
    case 'minimal':
      return (
        `<header style="margin-bottom: ${sp(c, 20)}"><div style="font-family: ${c.hfont}; font-size: 30px; font-weight: 300; letter-spacing: -0.5px; color: #111827">${esc(p.fullName)}</div>` +
        `<div style="margin: 4px 0 10px; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #6B7280">${esc(p.jobTitle)}</div>${contacts}</header>`
      );
    case 'center':
      return (
        `<header style="margin-bottom: ${sp(c, 16)}; text-align: center">${nameBlock(r, c, 'center', 26)}` +
        `<div style="margin-top: 8px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-size: 9.5px; color: #374151">${contactSpans(r)}</div></header>`
      );
    case 'split':
      return (
        `<header style="display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 12px; margin-bottom: ${sp(c, 16)}; border-bottom: 2px solid ${a}">` +
        `${nameBlock(r, c)}<div style="text-align: right; font-size: 9.5px; color: #374151">${contactDivs(r)}</div></header>`
      );
    case 'big': {
      const words = p.fullName.trim().split(/\s+/);
      return (
        `<header style="margin-bottom: ${sp(c, 18)}"><div style="font-family: ${c.hfont}; font-size: 48px; line-height: 0.95; font-weight: 800; letter-spacing: -1.5px; color: #111827">` +
        `${esc(words[0] ?? '')}<br><span style="color: ${a}">${esc(words.slice(1).join(' '))}</span></div>` +
        `<div style="margin: 10px 0 8px; font-size: 13px; font-weight: 600; color: #374151">${esc(p.jobTitle)}</div>${contacts}</header>`
      );
    }
    case 'bar':
      return (
        `<div style="position: absolute; left: 0; right: 0; top: 0; height: 10px; background: ${a}"></div>` +
        `<header style="margin: 10px 0 ${sp(c, 16)}">${nameBlock(r, c)}<div style="margin-top: 8px">${contacts}</div></header>`
      );
    case 'icons': {
      // each contact detail with its icon in a small accent circle, two to a row
      const items = contactFields(r)
        .map(
          ([icon, value]) =>
            `<span style="display: flex; align-items: center; gap: 5px"><span style="width: 18px; height: 18px; border-radius: 9px; background: ${tint(a, '1F')}; display: flex; align-items: center; justify-content: center">` +
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${a}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[icon]}"></path></svg></span>${esc(value)}</span>`,
        )
        .join('');
      return (
        `<header style="margin-bottom: ${sp(c, 18)}">${nameBlock(r, c, 'left', 28)}<div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; font-size: 9.5px; color: #374151">${items}</div></header>`
      );
    }
    case 'magazine':
      return (
        `<header style="margin-bottom: ${sp(c, 18)}; padding-bottom: 14px; border-bottom: 3px double ${a}"><div style="font-family: ${c.hfont}; font-size: 44px; line-height: 1; font-weight: 800; letter-spacing: -1px; color: #111827">${esc(p.fullName)}</div>` +
        `<div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px"><span style="font-family: ${c.hfont}; font-style: italic; font-size: 15px; color: ${a}">${esc(p.jobTitle)}</span>` +
        `<span style="font-size: 9.5px; color: #374151">${contactItems(r).slice(0, 2).map(esc).join(' · ')}</span></div></header>`
      );
    default:
      return `<header style="margin-bottom: ${sp(c, 16)}">${nameBlock(r, c)}<div style="margin-top: 8px">${contacts}</div></header>`;
  }
}

/** The icons header's pictures (the reference's ICONS): mail, phone, map pin, link. */
const ICONS = {
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
} as const;

/** Each filled contact detail with its icon: email, phone, city, link. */
const contactFields = (r: Resume) =>
  ([['mail', r.personal.email], ['phone', r.personal.phone], ['pin', r.personal.city], ['link', r.personal.link]] as [keyof typeof ICONS, string][])
    .map(([icon, v]): [keyof typeof ICONS, string] => [icon, v.trim()])
    .filter(([, v]) => v);

const contactItems = (r: Resume) => [r.personal.email, r.personal.phone, r.personal.city, r.personal.link].map((x) => x.trim()).filter(Boolean);
const contactSpans = (r: Resume) => contactItems(r).map((x) => `<span>${esc(x)}</span>`).join('');
const contactDivs = (r: Resume) => contactItems(r).map((x) => `<div>${esc(x)}</div>`).join('');

/** The Pakistan government CV: Objective, Personal information table, Academic qualification table, Experience,
 *  Skills, Languages, then any other section the person added, and the references line. */
function govPage(r: Resume, c: Ctx, keys: SectionKey[], changedAccent: boolean): string {
  const p = r.personal;
  const g = c.accent;
  const thBg = changedAccent ? tint(g, '12') : '#F0FDF4';
  const rows: [string, string | undefined][] = [
    ["Father's name", p.fatherName], ['CNIC', p.cnic], ['Date of birth', p.dateOfBirth], ['Domicile', p.domicile],
    ['Marital status', p.maritalStatus], ['Nationality', p.nationality], ['Address', p.address], ['Phone', p.phone], ['Email', p.email],
  ];
  const personal = rows
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `<tr><td style="padding: 3px 8px 3px 0; width: 120px; font-weight: 700; color: #111827; vertical-align: top">${esc(k)}</td><td style="padding: 3px 0; color: #374151">${esc(v!)}</td></tr>`)
    .join('');
  const th = `style="padding: 5px 6px; border: 1px solid #9CA3AF; background: ${thBg}; text-align: left; font-size: 9.5px; color: ${g}"`;
  const td = 'style="padding: 5px 6px; border: 1px solid #9CA3AF; font-size: 9.5px; color: #1F2937"';
  const gh = (s: string) => `<h2 style="margin: 14px 0 6px; padding: 3px 8px; background: ${g}; color: #FFFFFF; font-size: 11px; letter-spacing: 1px; text-transform: uppercase">${esc(s)}</h2>`;
  const year = (e: Resume['education'][number]) => (e.current ? 'Present' : e.end.trim() || e.start.trim());
  const shown = new Set(keys);

  const box = 'width: 86px; height: 104px; border: 1px solid #9CA3AF; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #6B7280';
  const passport =
    r.design.showPhoto && p.photoUri
      ? `<img src="${escAttr(p.photoUri)}" alt="" style="${box}; box-sizing: border-box; object-fit: cover">`
      : `<div style="${box}">Passport photo</div>`;

  let out =
    '<header style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px">' +
    `<div><div style="font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: ${g}; font-weight: 700">Curriculum Vitae</div>` +
    `<div style="margin-top: 6px; font-size: 26px; font-weight: 800; color: #111827">${esc(p.fullName)}</div></div>` +
    `${passport}</header>`;
  if (shown.has('summary')) out += `${gh('Objective')}${pText(r.summary)}`;
  if (personal) out += `${gh('Personal information')}<table style="border-collapse: collapse; width: 100%; font-size: 10px">${personal}</table>`;
  if (shown.has('education')) {
    const edu = r.education
      .map((e) => `<tr><td ${td}>${esc(e.degree)}</td><td ${td}>${esc(e.school)}</td><td ${td}>${esc(year(e))}</td><td ${td}>${esc(e.details)}</td></tr>`)
      .join('');
    out += `${gh('Academic qualification')}<table style="border-collapse: collapse; width: 100%"><tr><th ${th}>Degree</th><th ${th}>Board / University</th><th ${th}>Year</th><th ${th}>Marks / CGPA</th></tr>${edu}</table>`;
  }
  if (shown.has('experience')) out += `${gh('Experience')}${expHtml(r.experience, { ...c, accent: g, timeline: false })}`;
  if (shown.has('skills')) out += `${gh('Skills')}${listHtml(r.skills)}`;
  if (shown.has('languages')) out += `${gh('Languages')}${pText(r.languages.join(', '))}`;
  // anything else the person added (projects, certifications...), in their order, as plain sections
  for (const k of keys) {
    if (['summary', 'education', 'experience', 'skills', 'languages'].includes(k)) continue;
    out += `${gh(sectionTitle(r, k))}${sectionBody(k, r, { ...c, accent: g })}`;
  }
  return `${out}<p style="margin: 12px 0 0; font-style: italic; color: #4B5563">References will be furnished on request.</p>`;
}
