'use client';
import { useId } from 'react';
import { Info } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { OptionField, OptionValues, ToolOptions } from '@/tools/types';

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
    case 'segmented':
    case 'chips': {
      const segmented = f.kind === 'segmented';
      return (
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t(f.label)}</legend>
          <div className={segmented ? 'flex flex-wrap gap-1 p-1 rounded-full bg-fill w-fit max-w-full' : 'flex flex-wrap gap-2'} role="radiogroup">
            {f.options.map((o) => {
              const on = values[f.key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(f.key, o.value)}
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
      return (
        <div>
          <label htmlFor={id} className="block text-[13px] font-semibold mb-2">
            {t(f.label)}
          </label>
          <input
            id={id}
            value={String(values[f.key] ?? '')}
            inputMode={f.numeric ? 'numeric' : undefined}
            placeholder={f.placeholder}
            onChange={(e) => onChange(f.key, f.numeric ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
            className="w-full min-h-13 rounded-tile bg-surface border border-line-strong px-4 text-[15px] focus:outline-2 focus:outline-primary"
            dir="auto"
          />
          {f.hint && <p className="text-[12px] text-secondary mt-1.5">{t(f.hint)}</p>}
        </div>
      );
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
  }
}

/** Each field's default value. */
export function defaultValues(config: ToolOptions): OptionValues {
  const out: OptionValues = {};
  for (const f of config.fields) if ('key' in f) out[f.key] = f.default;
  return out;
}
