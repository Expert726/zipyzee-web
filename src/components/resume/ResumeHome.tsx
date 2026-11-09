'use client';
// Resume on the web (the app's Resume tab: ResumeHomeScreen + ResumeTemplatesScreen + ResumePreviewScreen): start a
// resume, your resumes (kept in this browser: open, rename, duplicate, delete), and the gallery of 100 templates
// (the app's 50 + 50 web ones) with the filter chips; a template opens a big preview with its colours, then "Use this
// template" starts a resume on it (your details from your last resume carried over, like the app).
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, FilePlus2, Pencil, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { accentsFor, badgeLabel, chipLabel, templateName, templateTraits } from '@/resume/labels';
import { resumeProgress } from '@/resume/progress';
import { createResume, duplicateResume, removeResume, updateResume, useResumes } from '@/resume/store';
import { createOptions, FILTER_CHIPS, getTemplate, templatesFor, type FilterChip, type TemplateConfig } from '@/resume/templates';
import type { Resume } from '@/resume/types';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

const thumb = (id: string) => `/resume-thumbs/${id}.png`;

function ago(t: (k: string, v?: Record<string, string | number>) => string, ms: number) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return t('Edited just now');
  if (m < 60) return t('Edited {n} min ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t('Edited {n} h ago', { n: h });
  return t('Edited {n} days ago', { n: Math.round(h / 24) });
}

export function ResumeHome({ lang }: { lang: string }) {
  const t = useT();
  const router = useRouter();
  const resumes = useResumes();
  const [chip, setChip] = useState<FilterChip>('All');
  const [preview, setPreview] = useState<TemplateConfig | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Resume | null>(null);
  const list = useMemo(() => templatesFor(chip), [chip]);

  const start = (tpl: TemplateConfig, color?: string | null) => {
    const o = createOptions(tpl);
    // the details from the last resume, so they aren't typed again (the app's "Use this template")
    const last = resumes?.[0]?.personal;
    const id = createResume(tpl.id, { ...o, design: { ...o.design, ...(color ? { accent: color } : {}) }, ...(last ? { personal: { ...last, photoUri: last.photoUri } } : {}) });
    router.push(`/${lang}/resume/edit?id=${id}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <button type="button" onClick={() => start(getTemplate('clean-ats'))} className="card p-6 text-start flex flex-col gap-3 hover:shadow-raised transition-shadow">
          <span className="size-12 rounded-tile lime-fill grid place-items-center">
            <FilePlus2 size={24} aria-hidden="true" />
          </span>
          <span className="text-[18px] font-semibold">{t('Create a resume')}</span>
          <span className="text-[14px] text-secondary">{t('Start on Clean ATS, or pick any of the {count} templates below. Change the template any time.', { count: 100 })}</span>
        </button>
        <div className="card p-5">
          <h2 className="text-[16px] font-semibold mb-3">{t('Your resumes')}</h2>
          {!resumes?.length ? (
            <p className="text-[14px] text-secondary">{t('Resumes you make are kept in this browser. They aren\'t uploaded anywhere.')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {resumes.map((r) => {
                const p = resumeProgress(r);
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the template's thumbnail */}
                    <img src={thumb(r.templateId)} alt="" className="w-10 h-14 rounded object-cover object-top border border-line shrink-0" />
                    <button type="button" onClick={() => router.push(`/${lang}/resume/edit?id=${r.id}`)} className="flex-1 min-w-0 text-start">
                      <span className="block font-semibold text-[14px] truncate" dir="auto">
                        {r.title}
                      </span>
                      <span className="block text-[12px] text-secondary">
                        {templateName(getTemplate(r.templateId))} · {p.percent}% · {ago(t, r.updatedAt)}
                      </span>
                    </button>
                    <button type="button" onClick={() => { const name = window.prompt(t('Rename'), r.title); if (name?.trim()) updateResume(r.id, { title: name.trim() }); }} aria-label={t('Rename')} title={t('Rename')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => duplicateResume(r.id)} aria-label={t('Duplicate')} title={t('Duplicate')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
                      <Copy size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setToDelete(r)} aria-label={t('Delete')} title={t('Delete')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[20px] font-semibold me-3">{t('{count} templates', { count: list.length })}</h2>
          {FILTER_CHIPS.map((c) => (
            <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)} className={`px-4 min-h-9 rounded-full text-sm font-medium border ${chip === c ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
              {chipLabel(c)}
            </button>
          ))}
        </div>
        <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((tpl) => (
            <li key={tpl.id}>
              <button type="button" onClick={() => { setPreview(tpl); setAccent(null); }} className="group w-full text-start">
                <span className="relative block rounded-lg overflow-hidden border border-line shadow-soft group-hover:shadow-raised transition-shadow bg-white aspect-[595/842]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- template thumbnail */}
                  <img src={thumb(tpl.id)} alt="" loading="lazy" className="size-full object-cover object-top" />
                  <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded-full bg-black/65 text-white text-[10px] font-semibold">{badgeLabel(tpl)}</span>
                </span>
                <span className="block mt-2 text-[14px] font-semibold">{templateName(tpl)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={templateName(preview)}>
          <button type="button" className="absolute inset-0 bg-overlay" aria-hidden="true" tabIndex={-1} onClick={() => setPreview(null)} />
          <div className="relative card w-full max-w-4xl max-h-[92dvh] overflow-y-auto p-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
            <button type="button" onClick={() => setPreview(null)} aria-label={t('Close')} className="absolute top-3 end-3 size-10 rounded-full grid place-items-center hover:bg-fill z-10">
              <X size={19} aria-hidden="true" />
            </button>
            <div className="rounded-lg border border-line overflow-hidden bg-white">
              {/* the thumbnail shows the template's own colour; picking another starts the resume with it */}
              {/* eslint-disable-next-line @next/next/no-img-element -- template preview */}
              <img src={thumb(preview.id)} alt={templateName(preview)} className="w-full" />
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-[22px] font-semibold pe-10">{templateName(preview)}</h2>
              <div className="flex flex-wrap gap-1.5">
                {templateTraits(preview).map((x) => (
                  <span key={x.label} className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${x.ats ? 'bg-success/10 text-success' : 'bg-fill'}`}>
                    {x.label}
                  </span>
                ))}
              </div>
              <fieldset>
                <legend className="text-[13px] font-semibold mb-2">{t('Colour')}</legend>
                <div className="flex flex-wrap gap-2">
                  {accentsFor(preview).map((a) => {
                    const on = (accent ?? preview.accent.toUpperCase()) === a.color.toUpperCase();
                    return <button key={a.color} type="button" aria-label={a.label} title={a.label} aria-pressed={on} onClick={() => setAccent(a.color)} className={`size-9 rounded-full ${on ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface' : ''}`} style={{ background: a.color }} />;
                  })}
                </div>
              </fieldset>
              <Button arrow onClick={() => start(preview, accent)}>
                {t('Use this template')}
              </Button>
              <p className="text-[12px] text-secondary">{t('Your words stay when you change the template later.')}</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        icon={<Trash2 size={22} aria-hidden="true" />}
        title={t('Delete this resume?')}
        body={toDelete ? t('"{title}" is deleted from this browser.', { title: toDelete.title }) : undefined}
        confirm={t('Delete')}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) removeResume(toDelete.id);
          setToDelete(null);
        }}
      />
    </div>
  );
}
