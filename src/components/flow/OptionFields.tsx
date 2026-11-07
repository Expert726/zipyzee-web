'use client';
import { useId, useRef, useState } from 'react';
import { Check, Eye, EyeOff, ImagePlus, Info } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { OptionField, OptionValues, ToolOptions } from '@/tools/types';
import { useObjectUrl } from '@/lib/objectUrls';

/** Renders a tool's option fields (the app's flow/steps/OptionFields). Labels are English keys. */
export function OptionFields({ config, values, onChange }: { config: ToolOptions; values: OptionValues; onChange: (key: string, value: OptionValues[string]) => void }) {
  const fields = config.fields.filter((f) => !('key' in f) || !config.visible || config.visible(f.key, values));
  if (!fields.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {fields.map((f, i) => (
        <Field key={'key' in f ? f.key : i} field={f} values={values} onChange={onChange} />
      ))}
    </div>
  );
}

function Field({ field: f, values, onChange }: { field: OptionField; values: OptionValues; onChange: (key: string, value: OptionValues[string]) => void }) {
  const t = useT();
  const id = useId();
  switch (f.kind) {
    case 'note':
      return (
        <p className="flex gap-2 items-start rounded-tile bg-info-soft text-info-ink p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t(f.text)}
        </p>
      );
    case 'groups':
      return (
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t(f.label)}</legend>
          <div className="flex flex-col gap-3 max-h-[26rem] overflow-y-auto pe-1 -me-1">
            {f.groups.map((g) => (
              <div key={g.label}>
                <p className="text-[12px] font-medium text-secondary mb-1.5">{t(g.label)}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t(g.label)}>
                  {g.options.map((o) => {
                    const on = values[f.key] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(f.key, o.value)}
                        className={`px-3.5 py-1.5 min-h-10 rounded-tile text-start border ${on ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong text-text hover:bg-fill'}`}
                      >
                        <span className="block text-[13px] font-medium leading-tight">{t(o.label)}</span>
                        {o.hint && (
                          <span className={`block text-[11px] leading-tight ${on ? 'opacity-75' : 'text-secondary'}`} dir="ltr">
                            {o.hint}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      );
    case 'segmented':
    case 'chips': {
      const segmented = f.kind === 'segmented';
      const multi = f.kind === 'chips' && !!f.multi;
      return (
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t(f.label)}</legend>
          <div className={segmented ? 'flex flex-wrap gap-1 p-1 rounded-full bg-fill w-fit max-w-full' : 'flex flex-wrap gap-2'} role={multi ? 'group' : 'radiogroup'}>
            {f.options.map((o) => {
              const chosen = multi ? ((values[f.key] as string[] | undefined) ?? []) : [];
              const on = multi ? chosen.includes(o.value) : values[f.key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role={multi ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  onClick={() =>
                    onChange(f.key, multi ? f.options.map((x) => x.value).filter((v) => (v === o.value ? !on : chosen.includes(v))) : o.value)
                  }
                  className={
                    segmented
                      ? `px-4 min-h-10 rounded-full text-sm font-medium ${on ? 'bg-ink text-on-ink shadow-soft' : 'text-muted hover:text-text'}`
                      : `px-4 min-h-10 rounded-full text-sm font-medium border ${on ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong text-text hover:bg-fill'}`
                  }
                >
                  {t(o.label)}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case 'toggle': {
      const on = values[f.key] === true;
      return (
        <label className="flex items-center gap-4 cursor-pointer">
          <span className="flex-1">
            <span className="block text-[15px] font-medium">{t(f.label)}</span>
            {f.sub && <span className="block text-[13px] text-secondary">{t(f.sub)}</span>}
          </span>
          <input type="checkbox" role="switch" className="peer sr-only" checked={on} onChange={(e) => onChange(f.key, e.target.checked)} />
          <span
            aria-hidden="true"
            className={`w-12 h-7 rounded-full p-0.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${on ? 'bg-primary' : 'bg-fill-strong'}`}
          >
            <span className={`block size-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5 rtl:-translate-x-5' : ''}`} />
          </span>
        </label>
      );
    }
    case 'text':
      return <TextField field={f} value={String(values[f.key] ?? '')} onChange={(v) => onChange(f.key, v)} />;
    case 'slider': {
      const v = Number(values[f.key] ?? f.default);
      return (
        <div>
          <label htmlFor={id} className="flex text-[13px] font-semibold mb-2">
            <span className="flex-1">{t(f.label)}</span>
            <span className="text-primary">
              {v}
              {f.unit}
            </span>
          </label>
          <input id={id} type="range" min={f.min} max={f.max} step={f.step ?? 1} value={v} onChange={(e) => onChange(f.key, Number(e.target.value))} className="w-full accent-[var(--primary)]" />
        </div>
      );
    }
    case 'color': {
      const v = String(values[f.key] ?? f.default);
      return (
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t(f.label)}</legend>
          <div className="flex flex-wrap gap-2 items-center" role="radiogroup">
            {f.colors.map((c) => {
              const on = v.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c}
                  onClick={() => onChange(f.key, c)}
                  className={`size-10 rounded-full grid place-items-center border-2 ${on ? 'border-primary' : 'border-line'}`}
                  style={{ background: c }}
                >
                  {on && <Check size={18} className="text-white drop-shadow" aria-hidden="true" />}
                </button>
              );
            })}
            <label className="size-10 rounded-full border-2 border-dashed border-line-strong grid place-items-center cursor-pointer relative overflow-hidden" title={t('Custom color')}>
              <span className="sr-only">{t('Custom color')}</span>
              <input type="color" value={v} onChange={(e) => onChange(f.key, e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="size-5 rounded-full" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} aria-hidden="true" />
            </label>
          </div>
        </fieldset>
      );
    }
    case 'image':
      return <ImageField field={f} file={values[f.key] instanceof File ? (values[f.key] as File) : null} onChange={(file) => onChange(f.key, file)} />;
  }
}

/** A text box; a password box (`secure`) gets a show / hide eye. */
function TextField({ field: f, value, onChange }: { field: Extract<OptionField, { kind: 'text' }>; value: string; onChange: (v: string) => void }) {
  const t = useT();
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold mb-2">
        {t(f.label)}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          type={f.secure && !shown ? 'password' : 'text'}
          autoComplete={f.secure ? 'off' : undefined}
          inputMode={f.numeric ? 'numeric' : undefined}
          placeholder={f.placeholder && t(f.placeholder)}
          onChange={(e) => onChange(f.numeric ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
          className={`w-full min-h-13 rounded-tile bg-surface border border-line-strong px-4 text-[15px] focus:outline-2 focus:outline-primary ${f.secure || f.suffix ? 'pe-12' : ''}`}
          dir={f.secure ? 'ltr' : 'auto'}
        />
        {f.suffix && <span className="absolute end-4 top-1/2 -translate-y-1/2 text-[14px] text-secondary pointer-events-none">{f.suffix}</span>}
        {f.secure && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? t('Hide password') : t('Show password')}
            aria-pressed={shown}
            className="absolute end-1.5 top-1/2 -translate-y-1/2 size-10 rounded-full grid place-items-center text-secondary hover:bg-fill"
          >
            {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
      {f.hint && <p className="text-[12px] text-secondary mt-1.5">{t(f.hint)}</p>}
    </div>
  );
}

function ImageField({ field: f, file, onChange }: { field: Extract<OptionField, { kind: 'image' }>; file: File | null; onChange: (f: File) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const url = useObjectUrl(file);
  return (
    <div>
      <p className="text-[13px] font-semibold mb-2">{t(f.label)}</p>
      <div className="flex items-center gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimize
          <img src={url} alt="" className="size-14 rounded-tile object-contain bg-fill" />
        )}
        <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border border-line-strong bg-surface hover:bg-fill text-sm font-medium">
          <ImagePlus size={18} aria-hidden="true" />
          {file ? t(f.change) : t(f.label)}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) onChange(picked);
            e.target.value = '';
          }}
        />
      </div>
      {f.hint && <p className="text-[12px] text-secondary mt-1.5">{t(f.hint)}</p>}
    </div>
  );
}

/** Each field's default value. */
export function defaultValues(config: ToolOptions): OptionValues {
  const out: OptionValues = {};
  for (const f of config.fields) if ('key' in f) out[f.key] = f.default;
  return out;
}
