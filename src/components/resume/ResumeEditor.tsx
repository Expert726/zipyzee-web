'use client';
// The resume editor on the web (the app's ResumeEditorScreen + ResumeSectionScreen + ResumeDesignScreen in one page):
// the progress, every section to fill in (open one at a time; move, hide, add more, "Fill with example"), the design
// (template, colour, font, spacing, page size, photo) and the live resume beside it, drawn by the same templates as the
// app (src/resume/templates). Download PDF prints the resume page with the browser (real text and fonts, ATS-friendly):
// choose "Save as PDF". Saved in this browser as you type.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, Camera, ChevronDown, Download, EyeOff, LayoutTemplate, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { addCustomSection, BUILT_IN_KEYS, canDownload, emptyEntry, exampleContent, hideSection, isEntrySection, move, removeCustomSection, showSection, switchTemplate, wordCount, type EntrySection } from '@/resume/editing';
import { accentsFor, templateName } from '@/resume/labels';
import { editorSections, resumeProgress, sectionLabel, sectionStatus, type EditorSection } from '@/resume/progress';
import { sectionConfig } from '@/resume/sections';
import { updateResume, useResume } from '@/resume/store';
import { getTemplate, render, TEMPLATES } from '@/resume/templates';
import { isCustomKey, type Education, type Experience, type FontChoice, type Project, type Resume, type SectionKey, type Spacing } from '@/resume/types';
import { Button } from '../ui/Button';
import { Choice, Switch } from '../custom/makedoc/parts';

const FONT_BASE = '/resume-fonts/';
const field = 'w-full min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[15px] font-normal';

function Field({ label, value, onChange, type = 'text', placeholder, dir = 'auto' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; dir?: string }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold min-w-0">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} dir={dir} className={field} />
    </label>
  );
}

/** One line per bullet. */
function Lines({ label, value, onChange, placeholder }: { label?: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const joined = value.join('\n');
  const [text, setText] = useState(joined);
  const [seen, setSeen] = useState(joined);
  // a change from outside (Fill with example) replaces the text; our own typing keeps blank lines as typed
  if (seen !== joined) {
    setSeen(joined);
    if (text.split('\n').map((x) => x.replace(/^\s*[-•*]\s*/, '')).filter((x) => x.trim()).join('\n') !== joined) setText(joined);
  }
  return (
    <label className="flex flex-col gap-1 text-[13px] font-semibold">
      {label}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value.split('\n').map((x) => x.replace(/^\s*[-•*]\s*/, '')).filter((x) => x.trim()));
        }}
        rows={Math.max(3, Math.min(10, text.split('\n').length + 1))}
        placeholder={placeholder}
        dir="auto"
        className={`${field} py-2 leading-relaxed`}
      />
    </label>
  );
}

/** Tags typed one at a time (Enter or comma adds). */
function Chips({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 ps-3 pe-1 py-1 rounded-full bg-fill text-[13px]" dir="auto">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`${v} ×`} className="size-6 rounded-full grid place-items-center hover:bg-fill-strong">
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        dir="auto"
        className={field}
      />
    </div>
  );
}

/** A photo, cropped square from the middle, kept in the resume as a small JPEG. */
async function photoData(f: File): Promise<string> {
  const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement('canvas');
  c.width = c.height = 400;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 400, 400);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.85);
}

function EntryEditor({ r, section }: { r: Resume; section: EntrySection }) {
  const t = useT();
  const list = r[section] as (Experience | Education | Project)[];
  const set = (next: typeof list) => updateResume(r.id, { [section]: next } as Partial<Resume>);
  const patch = (id: string, change: object) => set(list.map((e) => (e.id === id ? { ...e, ...change } : e)) as typeof list);
  const cfg = sectionConfig(section);
  return (
    <div className="flex flex-col gap-3">
      {list.map((e, i) => (
        <div key={e.id} className="rounded-row border border-line p-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-[12px] font-semibold text-secondary">{cfg.entry?.of(i + 1, list.length)}</span>
            <button type="button" disabled={i === 0} onClick={() => set(move(list, i, -1))} aria-label={t('Move up')} className="size-8 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <ArrowUp size={14} aria-hidden="true" />
            </button>
            <button type="button" disabled={i === list.length - 1} onClick={() => set(move(list, i, 1))} aria-label={t('Move down')} className="size-8 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <ArrowDown size={14} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => set(list.filter((x) => x.id !== e.id) as typeof list)} aria-label={t('Delete')} className="size-8 rounded-full grid place-items-center hover:bg-fill">
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
          {section === 'experience' && (() => {
            const x = e as Experience;
            return (
              <>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <Field label={t('Job title')} value={x.role} onChange={(v) => patch(x.id, { role: v })} />
                  <Field label={t('Company')} value={x.company} onChange={(v) => patch(x.id, { company: v })} />
                  <Field label={t('City')} value={x.city} onChange={(v) => patch(x.id, { city: v })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('Start')} placeholder="Mar 2021" value={x.start} onChange={(v) => patch(x.id, { start: v })} dir="ltr" />
                    {!x.current && <Field label={t('End')} placeholder="Jun 2024" value={x.end} onChange={(v) => patch(x.id, { end: v })} dir="ltr" />}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={x.current} onChange={(e2) => patch(x.id, { current: e2.target.checked })} className="size-4 accent-[var(--primary)]" />
                  {t('I work here now')}
                </label>
                <Lines label={t('What you did (one per line)')} value={x.bullets} onChange={(v) => patch(x.id, { bullets: v })} />
              </>
            );
          })()}
          {section === 'education' && (() => {
            const x = e as Education;
            return (
              <>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <Field label={t('Degree')} value={x.degree} onChange={(v) => patch(x.id, { degree: v })} />
                  <Field label={t('School or university')} value={x.school} onChange={(v) => patch(x.id, { school: v })} />
                  <Field label={t('Start')} placeholder="Mar 2021" value={x.start} onChange={(v) => patch(x.id, { start: v })} dir="ltr" />
                  {!x.current && <Field label={t('End')} placeholder="Jun 2024" value={x.end} onChange={(v) => patch(x.id, { end: v })} dir="ltr" />}
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={x.current} onChange={(e2) => patch(x.id, { current: e2.target.checked })} className="size-4 accent-[var(--primary)]" />
                  {t('I study here now')}
                </label>
                <Field label={t('Details (CGPA, marks, thesis)')} value={x.details} onChange={(v) => patch(x.id, { details: v })} />
              </>
            );
          })()}
          {section === 'projects' && (() => {
            const x = e as Project;
            return (
              <>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <Field label={t('Project name')} value={x.name} onChange={(v) => patch(x.id, { name: v })} />
                  <Field label={t('Link (optional)')} value={x.link ?? ''} onChange={(v) => patch(x.id, { link: v })} dir="ltr" />
                </div>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                  {t('Description')}
                  <textarea value={x.description} onChange={(e2) => patch(x.id, { description: e2.target.value })} rows={3} dir="auto" className={`${field} py-2`} />
                </label>
              </>
            );
          })()}
        </div>
      ))}
      <Button variant="secondary" onClick={() => set([...list, emptyEntry(section)] as typeof list)}>
        <Plus size={16} aria-hidden="true" className="inline me-1.5" />
        {cfg.entry?.add}
      </Button>
    </div>
  );
}

function SectionBody({ r, k }: { r: Resume; k: EditorSection }) {
  const t = useT();
  const cfg = sectionConfig(k);
  const photoInput = useRef<HTMLInputElement>(null);
  const tpl = getTemplate(r.templateId);
  const fill = () => {
    if (k === 'personal' || isCustomKey(k)) return;
    const ex = exampleContent(tpl.persona, k as Exclude<keyof Resume, 'customSections'> & EditorSection & keyof typeof r);
    updateResume(r.id, { [k]: ex[k as keyof typeof ex] } as Partial<Resume>);
  };
  const p = r.personal;
  const setP = (change: Partial<typeof p>) => updateResume(r.id, { personal: { ...p, ...change } });
  return (
    <div className="flex flex-col gap-3 pt-1">
      {k === 'personal' && (
        <>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => photoInput.current?.click()} className="size-16 rounded-full bg-fill grid place-items-center overflow-hidden shrink-0" aria-label={t('Photo')}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the resume photo */}
              {p.photoUri ? <img src={p.photoUri} alt="" className="size-full object-cover" /> : <Camera size={22} className="text-secondary" aria-hidden="true" />}
            </button>
            <div className="flex flex-col gap-1">
              <Switch label={t('Show photo')} value={r.design.showPhoto} onChange={(v) => updateResume(r.id, { design: { ...r.design, showPhoto: v } })} />
              {p.photoUri && (
                <button type="button" onClick={() => setP({ photoUri: undefined })} className="self-start text-[12px] text-primary hover:underline">
                  {t('Remove photo')}
                </button>
              )}
            </div>
            <input ref={photoInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setP({ photoUri: await photoData(f) }); updateResume(r.id, { design: { ...r.design, showPhoto: true } }); }} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label={t('Full name')} value={p.fullName} onChange={(v) => setP({ fullName: v })} />
            <Field label={t('Job title')} value={p.jobTitle} onChange={(v) => setP({ jobTitle: v })} />
            <Field label={t('Email')} type="email" value={p.email} onChange={(v) => setP({ email: v })} dir="ltr" />
            <Field label={t('Phone')} type="tel" value={p.phone} onChange={(v) => setP({ phone: v })} dir="ltr" />
            <Field label={t('City')} value={p.city} onChange={(v) => setP({ city: v })} />
            <Field label={t('Link (LinkedIn, GitHub...)')} value={p.link} onChange={(v) => setP({ link: v })} dir="ltr" />
          </div>
          {tpl.layout === 'gov' && (
            <div className="grid sm:grid-cols-2 gap-2.5">
              <Field label={t('Father\'s name')} value={p.fatherName ?? ''} onChange={(v) => setP({ fatherName: v })} />
              <Field label={t('CNIC')} value={p.cnic ?? ''} onChange={(v) => setP({ cnic: v })} dir="ltr" />
              <Field label={t('Date of birth')} type="date" value={p.dateOfBirth ?? ''} onChange={(v) => setP({ dateOfBirth: v })} dir="ltr" />
              <Field label={t('Domicile')} value={p.domicile ?? ''} onChange={(v) => setP({ domicile: v })} />
              <Field label={t('Marital status')} value={p.maritalStatus ?? ''} onChange={(v) => setP({ maritalStatus: v })} />
              <Field label={t('Nationality')} value={p.nationality ?? ''} onChange={(v) => setP({ nationality: v })} />
              <Field label={t('Address')} value={p.address ?? ''} onChange={(v) => setP({ address: v })} />
            </div>
          )}
        </>
      )}
      {k === 'summary' && (
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          <textarea value={r.summary} onChange={(e) => updateResume(r.id, { summary: e.target.value })} rows={5} dir="auto" className={`${field} py-2 leading-relaxed`} />
          <span className="text-[12px] font-normal text-secondary">{t('{count} words', { count: wordCount(r.summary) })}</span>
        </label>
      )}
      {isEntrySection(k) && <EntryEditor r={r} section={k} />}
      {cfg.kind === 'chips' && <Chips value={r[k as 'skills' | 'languages']} onChange={(v) => updateResume(r.id, { [k]: v } as Partial<Resume>)} placeholder={cfg.placeholder} />}
      {cfg.kind === 'bullets' && <Lines value={r[k as 'certifications' | 'achievements' | 'publications' | 'volunteering']} onChange={(v) => updateResume(r.id, { [k]: v } as Partial<Resume>)} placeholder={cfg.placeholder} />}
      {cfg.kind === 'custom' && isCustomKey(k as SectionKey) && (() => {
        const id = (k as string).slice('custom:'.length);
        const c = r.customSections.find((x) => x.id === id);
        if (!c) return null;
        const setC = (change: Partial<typeof c>) => updateResume(r.id, { customSections: r.customSections.map((x) => (x.id === id ? { ...x, ...change } : x)) });
        return (
          <>
            <Field label={t('Heading')} value={c.title} onChange={(v) => setC({ title: v })} />
            <Lines value={c.bullets} onChange={(v) => setC({ bullets: v })} placeholder={cfg.placeholder} />
          </>
        );
      })()}
      <p className="text-[12px] text-info-ink bg-info-soft rounded-tile p-2.5">{cfg.tip}</p>
      {k !== 'personal' && !isCustomKey(k as SectionKey) && (
        <button type="button" onClick={fill} className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
          <Sparkles size={14} aria-hidden="true" />
          {t('Fill with example')}
        </button>
      )}
    </div>
  );
}

export function ResumeEditor({ id, lang }: { id: string | null; lang: string }) {
  const t = useT();
  const r = useResume(id);
  const [open, setOpen] = useState<EditorSection | null>('personal');
  const [templates, setTemplates] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => (r ? render(r, { fontBase: FONT_BASE }) : ''), [r]);
  const [shown, setShown] = useState('');
  // redrawn a moment after typing stops (the app re-renders 300 ms after a change)
  useEffect(() => {
    const tm = setTimeout(() => setShown(html), 250);
    return () => clearTimeout(tm);
  }, [html]);

  if (r === undefined) return <Loader2 size={28} className="animate-spin text-primary mx-auto my-24" aria-hidden="true" />;
  if (r === null)
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3">
        <p className="text-[17px] font-semibold">{t('This resume isn\'t in this browser.')}</p>
        <Link href={`/${lang}/resume`} className="text-primary font-semibold hover:underline">
          {t('Back to resumes')}
        </Link>
      </div>
    );

  const tpl = getTemplate(r.templateId);
  const progress = resumeProgress(r);
  const sections = editorSections(r);
  const hidden = [...BUILT_IN_KEYS.filter((k) => r.hiddenSections.includes(k) || !r.sectionOrder.includes(k))];
  const ready = canDownload(r);

  const download = () => {
    const w = frame.current?.contentWindow;
    if (!w) return;
    // the PDF's suggested name comes from the page title
    w.document.title = (r.personal.fullName.trim() || r.title).replace(/[\\/:*?"<>|]/g, '') + ' resume';
    w.focus();
    w.print();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] items-start">
      <section className="flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/${lang}/resume`} aria-label={t('Back to resumes')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
              <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
            </Link>
            <input value={r.title} onChange={(e) => updateResume(r.id, { title: e.target.value })} aria-label={t('Resume name')} dir="auto" className="flex-1 min-w-0 min-h-10 rounded-tile bg-transparent hover:bg-fill focus:bg-fill px-2 text-[16px] font-semibold" />
            <span className="text-[12px] text-secondary shrink-0">{t('Saved')}</span>
          </div>
          <div>
            <div className="flex justify-between text-[12px] mb-1">
              <span className="font-semibold">{progress.label}</span>
              <span className="text-primary font-semibold">{progress.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-fill overflow-hidden">
              <div className="h-full rounded-full lime-fill transition-[width]" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="text-[12px] text-secondary mt-1">{progress.hint}</p>
          </div>
        </div>

        {sections.map((k, i) => {
          const isOpen = open === k;
          const order = r.sectionOrder.filter((x) => !r.hiddenSections.includes(x));
          const pos = k === 'personal' ? -1 : order.indexOf(k as SectionKey);
          return (
            <div key={k} className="card overflow-hidden">
              <div className="flex items-center gap-1 pe-2">
                <button type="button" onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen} className="flex-1 min-w-0 flex items-center gap-2 p-4 text-start">
                  <ChevronDown size={18} className={`shrink-0 transition-transform ${isOpen ? '' : '-rotate-90 rtl:rotate-90'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-[15px] truncate">{sectionLabel(r, k)}</span>
                    <span className="block text-[12px] text-secondary">{sectionStatus(r, k)}</span>
                  </span>
                </button>
                {k !== 'personal' && (
                  <>
                    <button type="button" disabled={pos <= 0} onClick={() => updateResume(r.id, { sectionOrder: move(order, pos, -1).concat(r.sectionOrder.filter((x) => r.hiddenSections.includes(x))) })} aria-label={t('Move up')} title={t('Move up')} className="size-8 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" disabled={pos >= order.length - 1} onClick={() => updateResume(r.id, { sectionOrder: move(order, pos, 1).concat(r.sectionOrder.filter((x) => r.hiddenSections.includes(x))) })} aria-label={t('Move down')} title={t('Move down')} className="size-8 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateResume(r.id, isCustomKey(k as SectionKey) ? removeCustomSection(r, k as SectionKey) : hideSection(r, k as SectionKey))}
                      aria-label={isCustomKey(k as SectionKey) ? t('Delete') : t('Hide')}
                      title={isCustomKey(k as SectionKey) ? t('Delete') : t('Hide')}
                      className="size-8 rounded-full grid place-items-center hover:bg-fill"
                    >
                      {isCustomKey(k as SectionKey) ? <Trash2 size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                    </button>
                  </>
                )}
              </div>
              {isOpen && (
                <div className="px-4 pb-4" key={`${k}-${i}`}>
                  <SectionBody r={r} k={k} />
                </div>
              )}
            </div>
          );
        })}

        <div className="card p-4 flex flex-col gap-2">
          <p className="text-[13px] font-semibold">{t('Add a section')}</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((k) => (
              <button key={k} type="button" onClick={() => { updateResume(r.id, showSection(r, k)); setOpen(k); }} className="px-3 min-h-9 rounded-full border border-line-strong text-[13px] font-medium hover:bg-fill">
                + {sectionLabel(r, k)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const { patch, key } = addCustomSection(r, t('Custom section'));
                updateResume(r.id, patch);
                setOpen(key);
              }}
              className="px-3 min-h-9 rounded-full border border-dashed border-line-strong text-[13px] font-medium hover:bg-fill"
            >
              + {t('Your own section')}
            </button>
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- the current template */}
            <img src={`/resume-thumbs/${tpl.id}.png`} alt="" className="w-12 h-16 rounded object-cover object-top border border-line" />
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] text-secondary">{t('Template')}</span>
              <span className="block font-semibold">{templateName(tpl)}</span>
            </span>
            <Button variant="secondary" onClick={() => setTemplates(true)}>
              <LayoutTemplate size={16} aria-hidden="true" className="inline me-1.5" />
              {t('Change')}
            </Button>
          </div>
          <fieldset>
            <legend className="text-[13px] font-semibold mb-2">{t('Colour')}</legend>
            <div className="flex flex-wrap gap-2 items-center">
              {accentsFor(tpl).map((a) => (
                <button key={a.color} type="button" aria-label={a.label} title={a.label} aria-pressed={r.design.accent.toUpperCase() === a.color.toUpperCase()} onClick={() => updateResume(r.id, { design: { ...r.design, accent: a.color } })} className={`size-8 rounded-full ${r.design.accent.toUpperCase() === a.color.toUpperCase() ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface' : ''}`} style={{ background: a.color }} />
              ))}
              <label className="size-8 rounded-full border border-line-strong overflow-hidden relative cursor-pointer" title={t('More colors')} style={{ background: 'conic-gradient(#F87171, #FBBF24, #A3E635, #38BDF8, #818CF8, #E879F9, #F87171)' }}>
                <input type="color" value={r.design.accent} onChange={(e) => updateResume(r.id, { design: { ...r.design, accent: e.target.value } })} aria-label={t('More colors')} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
          </fieldset>
          <Choice label={t('Font')} value={r.design.font} options={[['sans', t('Sans')], ['serif', t('Serif')], ['modern', t('Modern')]] as [FontChoice, string][]} onChange={(v) => updateResume(r.id, { design: { ...r.design, font: v } })} />
          <Choice label={t('Spacing')} value={r.design.spacing} options={[['compact', t('Compact')], ['normal', t('Normal')], ['roomy', t('Roomy')]] as [Spacing, string][]} onChange={(v) => updateResume(r.id, { design: { ...r.design, spacing: v } })} />
          <Choice label={t('Page')} value={r.design.pageSize} options={[['A4', 'A4'], ['Letter', t('Letter')]]} onChange={(v) => updateResume(r.id, { design: { ...r.design, pageSize: v } })} />
        </div>
      </section>

      <section className="lg:sticky lg:top-20 flex flex-col gap-3">
        <div className="card p-3 flex items-center gap-2">
          <p className="flex-1 text-[13px] text-secondary px-1">{ready ? t('Download, then choose "Save as PDF" in the print window.') : t('Add your name and an email or phone to download.')}</p>
          <Button arrow disabled={!ready} onClick={download}>
            <Download size={16} aria-hidden="true" className="inline me-1.5" />
            {t('Download PDF')}
          </Button>
        </div>
        <div className="card p-3 bg-fill">
          <iframe ref={frame} title={t('Resume preview')} srcDoc={shown} className="w-full h-[calc(100dvh-12rem)] min-h-[32rem] rounded-md bg-white border border-line" />
        </div>
      </section>

      {templates && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={t('Change template')}>
          <button type="button" className="absolute inset-0 bg-overlay" aria-hidden="true" tabIndex={-1} onClick={() => setTemplates(false)} />
          <div className="relative card w-full max-w-5xl max-h-[90dvh] overflow-y-auto p-5">
            <div className="flex items-center mb-4">
              <h2 className="flex-1 text-[18px] font-semibold">{t('Change template')}</h2>
              <button type="button" onClick={() => setTemplates(false)} aria-label={t('Close')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <p className="text-[13px] text-secondary mb-4">{t('Your words stay when you change the template later.')}</p>
            <ul className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
              {TEMPLATES.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => { updateResume(r.id, switchTemplate(r, x.id)); setTemplates(false); }} className={`w-full text-start rounded-lg p-1 ${x.id === tpl.id ? 'ring-3 ring-primary' : 'hover:bg-fill'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- template thumbnail */}
                    <img src={`/resume-thumbs/${x.id}.png`} alt="" loading="lazy" className="w-full aspect-[595/842] object-cover object-top rounded border border-line" />
                    <span className="block mt-1 text-[13px] font-semibold">{templateName(x)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
