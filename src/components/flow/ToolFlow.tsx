'use client';
// The generic tool flow (the app's src/flow/ToolFlowScreen): pick → setup → processing → result (+ error).
// Everything runs in the browser; files are never uploaded.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Download, FileText, Image as ImageIcon, Plus, RotateCcw, X } from 'lucide-react';
import { useLanguage, useT } from '@/i18n/client';
import { formatBytes } from '@/lib/format';
import { ACCEPT, TOOL_OPTIONS } from '@/tools/options';
import { getTool } from '@/tools/registry';
import { multiInput, ToolError, type OptionValues, type ToolResult } from '@/tools/types';
import { Button } from '../ui/Button';
import { defaultValues, OptionFields } from './OptionFields';

type Step =
  | { kind: 'pick' }
  | { kind: 'setup' }
  | { kind: 'processing'; done: number; total: number; label: string }
  | { kind: 'result'; result: ToolResult; urls: string[] }
  | { kind: 'error'; message: string };

export function ToolFlow({ toolId }: { toolId: string }) {
  const t = useT();
  const lang = useLanguage();
  const tool = getTool(toolId)!;
  const config = useMemo(() => TOOL_OPTIONS[toolId] ?? { fields: [] }, [toolId]);
  const multi = multiInput(tool.input);
  const minFiles = tool.minFiles ?? 1;

  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [files, setFiles] = useState<File[]>([]);
  const [values, setValues] = useState<OptionValues>(() => defaultValues(config));
  const signal = useRef({ cancelled: false });
  const input = useRef<HTMLInputElement>(null);

  // object URLs of the result files are freed when the result goes away
  const urls = step.kind === 'result' ? step.urls : null;
  useEffect(() => () => urls?.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const accept = ACCEPT[tool.input] ?? '';
  const addFiles = (list: FileList | File[]) => {
    const picked = [...list].filter((f) => matches(f, tool.input));
    if (!picked.length) return;
    setFiles((cur) => (multi ? [...cur, ...picked] : [picked[0]]));
    setStep({ kind: 'setup' });
  };

  const removeAt = (i: number) => {
    const next = files.filter((_, j) => j !== i);
    setFiles(next);
    if (!next.length) setStep({ kind: 'pick' });
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...files];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setFiles(next);
  };

  const error = step.kind === 'setup' ? (files.length < minFiles ? t('Choose at least {count} files', { count: minFiles }) : config.validate?.(values, files) ?? null) : null;

  const start = async () => {
    signal.current = { cancelled: false };
    setStep({ kind: 'processing', done: 0, total: 1, label: t(tool.processing) });
    try {
      // loaded on Start, so pdf-lib isn't in the page's first download
      const handler = (await import('@/tools/handlers')).HANDLERS[toolId];
      const result = await handler({
        tool,
        files,
        options: values,
        signal: signal.current,
        onProgress: (done, total, label) => setStep({ kind: 'processing', done, total, label }),
      });
      if (signal.current.cancelled) return;
      setStep({ kind: 'result', result, urls: result.files.map((f) => URL.createObjectURL(f.blob)) });
    } catch (e) {
      if (signal.current.cancelled) return;
      console.error(e);
      setStep({ kind: 'error', message: e instanceof ToolError ? e.message : t('Something went wrong. Try again.') });
    }
  };

  const cancel = () => {
    signal.current.cancelled = true;
    setStep({ kind: 'setup' });
  };

  const reset = () => {
    setFiles([]);
    setValues(defaultValues(config));
    setStep({ kind: 'pick' });
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept={accept}
      multiple={multi}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        if (e.target.files) addFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (step.kind === 'pick') {
    return (
      <div
        className="card p-6 sm:p-10 flex flex-col items-center text-center gap-4 border-2 border-dashed !border-line-strong"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        {fileInput}
        <span className="size-16 rounded-full bg-primary-soft grid place-items-center text-primary">
          <Plus size={28} aria-hidden="true" />
        </span>
        <p className="text-[17px] font-semibold">{multi ? t(isPdf(tool.input) ? 'Choose PDFs' : 'Choose photos') : t(isPdf(tool.input) ? 'Choose a PDF' : 'Choose a photo')}</p>
        <p className="text-[13px] text-secondary">{t('or drop them here')}</p>
        <Button arrow onClick={() => input.current?.click()} className="min-w-64">
          {t('Choose files')}
        </Button>
      </div>
    );
  }

  if (step.kind === 'processing') {
    const pct = Math.round((step.done / Math.max(1, step.total)) * 100);
    return (
      <div className="card p-8 flex flex-col items-center gap-5 text-center" role="status" aria-live="polite">
        <p className="text-[17px] font-semibold">{t(tool.processing)}</p>
        <div className="w-full max-w-md h-2 rounded-full bg-fill overflow-hidden">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[13px] text-secondary">{step.label}</p>
        <Button variant="secondary" onClick={cancel}>
          {t('Cancel')}
        </Button>
      </div>
    );
  }

  if (step.kind === 'error') {
    return (
      <div className="card p-8 flex flex-col items-center gap-4 text-center" role="alert">
        <AlertCircle size={40} className="text-error" aria-hidden="true" />
        <p className="text-[17px] font-semibold">{t('That didn\'t work')}</p>
        <p className="text-[15px] text-muted max-w-md">{step.message}</p>
        <div className="flex gap-2 flex-wrap justify-center">
          <Button onClick={() => setStep({ kind: 'setup' })}>{t('Try again')}</Button>
          <Button variant="secondary" onClick={reset}>
            {t('Start over')}
          </Button>
        </div>
      </div>
    );
  }

  if (step.kind === 'result') {
    const { result } = step;
    const next = tool.next ? getTool(tool.next) : undefined;
    const downloadAll = () => result.files.forEach((f, i) => setTimeout(() => save(step.urls[i], f.name), i * 300));
    return (
      <div className="flex flex-col gap-4">
        <div className="card p-6 sm:p-8 flex flex-col items-center gap-2 text-center" role="status">
          <CheckCircle2 size={44} className="text-success" aria-hidden="true" />
          <h2 className="text-[22px] font-semibold tracking-tight">{result.title}</h2>
          {result.subtitle && <p className="text-[15px] text-secondary">{result.subtitle}</p>}
        </div>
        <ul className="flex flex-col gap-2">
          {result.files.map((f, i) => (
            <li key={i} className="card !rounded-row p-3 ps-4 flex items-center gap-3">
              <FileIcon name={f.name} />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-[15px]" dir="auto">
                  {f.name}
                </span>
                <span className="block text-[12px] text-secondary">{formatBytes(f.blob.size)}</span>
              </span>
              <a href={step.urls[i]} download={f.name} className="lime-fill rounded-full min-h-11 px-4 inline-flex items-center gap-2 font-semibold text-sm">
                <Download size={18} aria-hidden="true" />
                {t('Download')}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 flex-wrap">
          {result.files.length > 1 && (
            <Button variant="secondary" onClick={downloadAll}>
              <Download size={18} aria-hidden="true" className="inline me-2" />
              {t('Download all')}
            </Button>
          )}
          <Button variant="secondary" onClick={reset}>
            <RotateCcw size={18} aria-hidden="true" className="inline me-2" />
            {t('Start over')}
          </Button>
          {next && next.web && (
            <Link href={`/${lang}/tools/${next.id}`} className="inline-flex items-center min-h-12 px-5 rounded-full text-[15px] font-semibold text-primary hover:bg-fill">
              {t('Next: {name}', { name: t(next.name) })}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // setup
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <section className="card p-4 sm:p-5 flex flex-col gap-2" aria-label={t('Your files')}>
        {fileInput}
        <ul className="flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="rounded-row bg-fill p-3 flex items-center gap-3">
              <FileIcon name={f.name} />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-[15px]" dir="auto">
                  {f.name}
                </span>
                <span className="block text-[12px] text-secondary">{formatBytes(f.size)}</span>
              </span>
              {multi && files.length > 1 && (
                <>
                  <IconBtn label={t('Move up')} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={18} />
                  </IconBtn>
                  <IconBtn label={t('Move down')} disabled={i === files.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={18} />
                  </IconBtn>
                </>
              )}
              <IconBtn label={t('Remove {name}', { name: f.name })} onClick={() => removeAt(i)}>
                <X size={18} />
              </IconBtn>
            </li>
          ))}
        </ul>
        {multi && (
          <Button variant="ghost" onClick={() => input.current?.click()} className="self-start">
            <Plus size={18} aria-hidden="true" className="inline me-1" />
            {t('Add more files')}
          </Button>
        )}
      </section>
      <section className="card p-5 flex flex-col gap-5" aria-label={t('Options')}>
        <OptionFields config={config} values={values} onChange={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
        {error && (
          <p className="text-[13px] text-error" role="alert">
            {error}
          </p>
        )}
        <Button arrow disabled={!!error} onClick={start} className="w-full">
          {t(tool.verb, { count: files.length })}
        </Button>
      </section>
    </div>
  );
}

const isPdf = (input: string) => input === 'pdf' || input === 'pdfs';

function matches(f: File, input: string) {
  if (isPdf(input)) return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);
}

function FileIcon({ name }: { name: string }) {
  const pdf = /\.pdf$/i.test(name);
  return (
    <span className="size-10 shrink-0 rounded-tile bg-surface grid place-items-center text-text" aria-hidden="true">
      {pdf ? <FileText size={20} /> : <ImageIcon size={20} />}
    </span>
  );
}

function IconBtn({ label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="size-10 rounded-full grid place-items-center hover:bg-fill-strong disabled:opacity-30" {...rest}>
      {children}
    </button>
  );
}

function save(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}
