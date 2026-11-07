'use client';
// PDF forms' step 2 (the app's custom/FormsStep, for the web): every page drawn by pdf.js with the form's own fields
// laid over it where they are on the page (text, multi-line text, checkbox, radio choices, dropdown), filled in place;
// beside it every field as a list (easier on a phone and with a keyboard). "Lock fields after saving" flattens them.
// Reading and filling: the app's src/tools/forms.ts.
import { useEffect, useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Loader2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import { readFields, type FormField, type FormValues } from '@/tools/forms';
import { visualRect } from '@/tools/pdfOps';
import { Button } from '../../ui/Button';
import { Switch } from '../../custom/makedoc/parts';
import type { CustomSetupProps } from './index';

const PAGE_DPI = 110;

type Placed = { field: FormField; page: number; left: number; top: number; width: number; height: number; option?: string };
type PageSize = { width: number; height: number };

export function FormsEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const pages = usePdfThumbs(file, PAGE_DPI);
  const [form, setForm] = useState<{ fields: FormField[]; sizes: PageSize[]; placed: Placed[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [lock, setLock] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false });
        const fields = readFields(doc);
        const docPages = doc.getPages();
        const placed: Placed[] = fields.flatMap((field) =>
          field.widgets
            .filter((w) => docPages[w.page])
            .map((w) => {
              const r = visualRect(docPages[w.page], w.rect);
              return { field, page: w.page, left: r.left / r.pageWidth, top: r.top / r.pageHeight, width: r.width / r.pageWidth, height: r.height / r.pageHeight, option: w.option };
            }),
        );
        const sizes = docPages.map((p) => {
          const r = visualRect(p, [0, 0, 1, 1]);
          return { width: r.pageWidth, height: r.pageHeight };
        });
        if (!alive) return;
        setForm({ fields, sizes, placed });
        setValues(Object.fromEntries(fields.map((f) => [f.name, f.value])));
      } catch (e) {
        if (alive) setError(/encrypt/i.test(String(e)) ? t('{name} is password protected. Unlock it first.', { name: file.name }) : t('Could not read this form.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);

  const set = (name: string, v: string | boolean) => setValues((cur) => ({ ...cur, [name]: v }));
  const changed = useMemo(() => (form ? form.fields.filter((f) => values[f.name] !== f.value) : []), [form, values]);

  if (error || pages.error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error ?? pages.error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }
  if (!form) {
    return (
      <div className="card min-h-64 grid place-items-center" aria-busy="true">
        <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }
  if (!form.fields.length) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="status">
        <p className="text-[17px] font-semibold">{t('This PDF has no form fields to fill.')}</p>
        <p className="text-[14px] text-secondary max-w-md">{t('To write on a PDF without fields, use Annotate and sign.')}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="flex flex-col items-center gap-6 min-w-0">
        {form.sizes.map((s, page) => {
          const here = form.placed.filter((p) => p.page === page);
          return (
            <div key={page} className="w-full max-w-3xl">
              <p className="text-[12px] text-secondary mb-1">{t('Page {n}', { n: page + 1 })}</p>
              <div className="relative bg-paper shadow-raised" style={{ aspectRatio: `${s.width} / ${s.height}`, containerType: 'inline-size' }}>
                {pages.urls[page] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser
                  <img src={pages.urls[page]} alt="" className="absolute inset-0 size-full select-none" draggable={false} />
                ) : (
                  <Loader2 size={24} className="absolute inset-0 m-auto animate-spin text-secondary" aria-hidden="true" />
                )}
                {here.map((p, i) => (
                  <OnPage key={`${p.field.name}-${i}`} p={p} pageWidth={s.width} pageHeight={s.height} value={values[p.field.name]} onChange={(v) => set(p.field.name, v)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20 max-h-[calc(100dvh-6rem)]" aria-label={t('Fields')}>
        <h2 className="text-[15px] font-semibold">{t('{count} fields', { count: form.fields.length })}</h2>
        <div className="flex flex-col gap-3 overflow-y-auto -mx-1 px-1 min-h-0">
          {form.fields.map((f) => (
            <ListField key={f.name} field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} />
          ))}
        </div>
        <Switch label={t('Lock fields after saving')} sub={t('Others can no longer edit them')} value={lock} onChange={setLock} />
        <Button arrow disabled={!changed.length && !lock} onClick={() => onStart({ fields: values, lock })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}

const fieldLook = 'bg-[#DBEAFE]/70 hover:bg-[#DBEAFE] focus:bg-white focus:outline-2 focus:outline-[#2563EB] text-[#111827] border border-[#93C5FD]';

/** A field where it is on the page; its text sized to the box (container query units follow the page's width). */
function OnPage({ p, pageWidth, pageHeight, value, onChange }: { p: Placed; pageWidth: number; pageHeight: number; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const f = p.field;
  const style: React.CSSProperties = { left: `${p.left * 100}%`, top: `${p.top * 100}%`, width: `${p.width * 100}%`, height: `${p.height * 100}%` };
  // the text: ~62 % of a one-line box's height in points (7-14 pt; 10 pt in a multi-line box), as cqw of the page's
  // width so it scales with the page (1 pt = 100 / pageWidth cqw)
  const pt = f.multiline ? 10 : Math.max(7, Math.min(14, p.height * pageHeight * 0.62));
  const textSize = `${(pt * 100) / pageWidth}cqw`;
  if (f.type === 'checkbox') {
    return (
      <input type="checkbox" aria-label={f.label} checked={value === true} onChange={(e) => onChange(e.target.checked)} className="absolute m-0 accent-[#2563EB] cursor-pointer" style={style} />
    );
  }
  if (f.type === 'radio') {
    return (
      <input type="radio" name={`r-${f.name}`} aria-label={`${f.label}: ${p.option}`} checked={value === p.option} onChange={() => onChange(p.option ?? '')} className="absolute m-0 accent-[#2563EB] cursor-pointer" style={style} />
    );
  }
  if (f.type === 'dropdown') {
    return (
      <select aria-label={f.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={`absolute px-1 rounded-sm ${fieldLook}`} style={{ ...style, fontSize: textSize }}>
        <option value="" />
        {f.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return f.multiline ? (
    <textarea aria-label={f.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} dir="auto" className={`absolute resize-none px-1 rounded-sm leading-tight ${fieldLook}`} style={{ ...style, fontSize: textSize }} />
  ) : (
    <input aria-label={f.label} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} dir="auto" className={`absolute px-1 rounded-sm ${fieldLook}`} style={{ ...style, fontSize: textSize }} />
  );
}

/** The same field in the side list. */
function ListField({ field: f, value, onChange }: { field: FormField; value: string | boolean | undefined; onChange: (v: string | boolean) => void }) {
  const t = useT();
  const id = `ff-${f.name}`;
  if (f.type === 'checkbox') {
    return (
      <label className="flex items-center gap-3 text-[14px] min-h-10">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--primary)]" />
        <span dir="auto">{f.label}</span>
      </label>
    );
  }
  if (f.type === 'radio' || f.type === 'dropdown') {
    return (
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor={id}>
        <span dir="auto">{f.label}</span>
        <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-normal">
          <option value="">—</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold" htmlFor={id}>
      <span dir="auto">{f.label}</span>
      {f.multiline ? (
        <textarea id={id} rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} dir="auto" className="rounded-tile bg-surface border border-line-strong p-3 text-[14px] font-normal" />
      ) : (
        <input id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} dir="auto" placeholder={f.date ? t('e.g. 16 Oct 2026') : undefined} className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-normal" />
      )}
    </label>
  );
}
