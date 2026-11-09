'use client';
// The generic tool flow (the app's src/flow/ToolFlowScreen): pick → setup → processing → result (+ error).
// Everything runs in the browser; files are never uploaded.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Plus, ShieldCheck, Upload, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { MIN_PROCESSING_MS } from '@/config';
import { clearHandoff, peekHandoff } from '@/lib/handoff';
import { shownProgress, timeLeft, waitUnlessCancelled } from '@/lib/processingPace';
import { formatBytes } from '@/lib/format';
import { ACCEPT, TOOL_OPTIONS } from '@/tools/options';
import { getTool } from '@/tools/registry';
import { multiInput, ToolError, type OptionValues, type ToolResult } from '@/tools/types';
import { Button } from '../ui/Button';
import { defaultValues, OptionFields } from './OptionFields';
import { Processing } from './Processing';
import { Result } from './Result';
import { verbLabel } from '@/tools/verb';
import { CUSTOM_RESULTS, CUSTOM_SETUPS } from './custom';
import { isolateOnce } from '@/lib/isolated';
import { RECENT_GROUPS, RecentPick } from './RecentPick';
import { PickedPreview, PickedViewer } from './PickedPreview';
import { LIVE_PREVIEWS } from './previews';

const fileKey = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

type Step =
  | { kind: 'pick' }
  | { kind: 'setup' }
  | { kind: 'processing'; real: number; label: string }
  | { kind: 'result'; result: ToolResult; urls: string[] }
  | { kind: 'error'; message: string };

export function ToolFlow({ toolId }: { toolId: string }) {
  const t = useT();
  const tool = getTool(toolId)!;
  const config = useMemo(() => TOOL_OPTIONS[toolId] ?? { fields: [] }, [toolId]);
  const multi = multiInput(tool.input);
  const minFiles = tool.minFiles ?? 1;
  // a tool that makes something from nothing (Signature maker) starts on its editor, with no file to pick
  const empty: Step = tool.input === 'camera' && CUSTOM_SETUPS[toolId] ? { kind: 'setup' } : { kind: 'pick' };

  // a result handed over from another tool ("Continue to…") starts on the options
  const [handed] = useState(() => peekHandoff(toolId));
  const [step, setStep] = useState<Step>(() => (handed ? { kind: 'setup' } : empty));
  const [files, setFiles] = useState<File[]>(() => handed ?? []);
  useEffect(() => clearHandoff(toolId), [toolId]);
  // the big-model tools reload once to get several CPU cores (src/lib/isolated.ts)
  useEffect(() => void isolateOnce(toolId, !!handed), [toolId, handed]);
  // the ring's pace: the real progress, never ahead of an even sweep over MIN_PROCESSING_MS
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const processing = step.kind === 'processing';
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [processing]);
  const [values, setValues] = useState<OptionValues>(() => defaultValues(config));
  // the picked files' previews: full size, and each photo's "W × H"
  const [viewing, setViewing] = useState<number | null>(null);
  const [pixels, setPixels] = useState<Record<string, string>>({});
  const signal = useRef({ cancelled: false });
  const input = useRef<HTMLInputElement>(null);

  // object URLs of the result files are freed when the result goes away
  const urls = step.kind === 'result' ? step.urls : null;
  useEffect(() => () => urls?.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  // while choosing, files can be dropped anywhere on the page
  const [dragging, setDragging] = useState(false);
  const picking = step.kind === 'pick' || step.kind === 'setup';
  const dropRef = useRef<(list: FileList) => void>(() => {});
  useEffect(() => {
    if (!picking) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.files.length) dropRef.current(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [picking]);

  // a single PDF's page count, for buttons like "Convert 12 pages" (read with pdf-lib once it's picked)
  const [pageCount, setPageCount] = useState<number | undefined>(undefined);
  const counted = tool.input === 'pdf' && tool.verb.includes('{pages}') ? files[0] : undefined;
  useEffect(() => {
    if (!counted) return;
    let live = true;
    (async () => {
      try {
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.load(await counted.arrayBuffer(), { updateMetadata: false, ignoreEncryption: true });
        if (live) setPageCount(doc.getPageCount());
      } catch {
        if (live) setPageCount(undefined);
      }
    })();
    return () => {
      live = false;
    };
  }, [counted]);

  const accept = ACCEPT[tool.input] ?? '';
  const addFiles = (list: FileList | File[]) => {
    const picked = [...list].filter((f) => matches(f, tool.input));
    if (!picked.length) return;
    setFiles((cur) => (multi ? [...cur, ...picked] : [picked[0]]));
    setStep({ kind: 'setup' });
  };

  useEffect(() => {
    dropRef.current = addFiles;
  });

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

  /** `with`: values from a tool's own editor (Organize...) instead of the option fields. */
  const start = async (withValues?: OptionValues) => {
    signal.current = { cancelled: false };
    const mine = signal.current;
    const began = Date.now();
    setStartedAt(began);
    setNow(began);
    let lastLabel = t(tool.processing);
    setStep({ kind: 'processing', real: 0, label: lastLabel });
    try {
      // loaded on Start, so pdf-lib isn't in the page's first download
      const handler = (await import('@/tools/handlers')).HANDLERS[toolId];
      const result = await handler({
        tool,
        files,
        options: withValues ?? values,
        signal: mine,
        onProgress: (done, total, label) => {
          lastLabel = label;
          setStep({ kind: 'processing', real: total ? done / total : 0, label });
        },
      });
      if (mine.cancelled) return;
      // the work is done; the ring keeps its pace and the last step stays until "Almost done" (see render)
      setStep({ kind: 'processing', real: 1, label: lastLabel });
      if (!(await waitUnlessCancelled(timeLeft(Date.now() - began, MIN_PROCESSING_MS), mine))) return;
      setStep({ kind: 'result', result, urls: result.files.map((f) => URL.createObjectURL(f.blob)) });
    } catch (e) {
      if (mine.cancelled) return;
      if (!(e instanceof ToolError)) console.error(e); // expected messages (wrong password...) aren't errors
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
    setStep(empty);
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

  const dropOverlay = dragging && (
    <div className="fixed inset-0 z-50 bg-overlay grid place-items-center p-6 pointer-events-none" aria-hidden="true">
      <div className="rounded-card border-4 border-dashed border-ink bg-surface/90 px-10 py-12 text-[20px] font-semibold">{t('Drop files here')}</div>
    </div>
  );

  if (step.kind === 'pick') {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-4">
        {fileInput}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="lime-fill rounded-[20px] min-h-16 sm:min-h-[72px] px-10 sm:px-14 text-[18px] sm:text-[20px] font-semibold shadow-soft hover:brightness-95 inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Upload size={22} aria-hidden="true" />
          {chooseLabel(t, tool.input)}
        </button>
        <p className="text-[13px] text-secondary">{t('or drop them here')}</p>
        {RECENT_GROUPS[toolId] && (
          <RecentPick
            group={RECENT_GROUPS[toolId]}
            onPick={(f) => {
              setFiles([f]);
              setStep({ kind: 'setup' });
            }}
          />
        )}
        <p className="flex items-center gap-1.5 text-[13px] text-secondary mt-4">
          <ShieldCheck size={16} className="text-brand" aria-hidden="true" />
          {t('Your files are processed in your browser and never uploaded.')}
        </p>
        {dropOverlay}
      </div>
    );
  }

  if (step.kind === 'processing') {
    const shown = shownProgress(step.real, now - startedAt, MIN_PROCESSING_MS);
    return <Processing tool={tool} progress={shown} label={step.real >= 1 && shown >= 0.9 ? t('Almost done') : step.label} onCancel={cancel} />;
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
    const CustomResult = CUSTOM_RESULTS[toolId];
    if (CustomResult) return <CustomResult tool={tool} files={files} result={step.result} onReset={reset} />;
    return <Result tool={tool} result={step.result} urls={step.urls} onBack={() => setStep({ kind: 'setup' })} onReset={reset} />;
  }

  // a tool with its own editor instead of the option fields (the app's CUSTOM_SETUPS)
  const Custom = CUSTOM_SETUPS[toolId];
  if (Custom) {
    return (
      <>
        {fileInput}
        {dropOverlay}
        <Custom
          tool={tool}
          files={files}
          onStart={(v) => void start(v)}
          onReplace={() => input.current?.click()}
          onFiles={(next) => {
            setFiles(next);
            if (!next.length) setStep({ kind: 'pick' });
          }}
        />
      </>
    );
  }

  // setup (a tool with a live preview shows its options on the real file under the list)
  const LivePreview = LIVE_PREVIEWS[toolId];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <section className="card p-4 sm:p-5 flex flex-col gap-2" aria-label={t('Your files')}>
        {fileInput}
        {viewing != null && files[viewing] && <PickedViewer files={files} start={viewing} onClose={() => setViewing(null)} />}
        {dropOverlay}
        <ul className="flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="rounded-row bg-fill p-3 flex items-center gap-3">
              <PickedPreview file={f} onOpen={() => setViewing(i)} onSize={(px) => setPixels((m) => (m[fileKey(f)] === px ? m : { ...m, [fileKey(f)]: px }))} />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-[15px]" dir="auto">
                  {f.name}
                </span>
                <span className="block text-[12px] text-secondary">
                  {formatBytes(f.size)}
                  {pixels[fileKey(f)] && <span dir="ltr"> · {pixels[fileKey(f)]}</span>}
                </span>
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
        {LivePreview && files.length > 0 && <LivePreview files={files} values={values} />}
      </section>
      <section className="card p-5 flex flex-col gap-5" aria-label={t('Options')}>
        <OptionFields config={config} values={values} onChange={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
        {error && (
          <p className="text-[13px] text-error" role="alert">
            {error}
          </p>
        )}
        <Button arrow disabled={!!error} onClick={() => void start()} className="w-full">
          {verbLabel(t, tool.verb, files.length, values, pageCount)}
        </Button>
      </section>
    </div>
  );
}

const isPdf = (input: string) => input === 'pdf' || input === 'pdfs';

/** Whether a picked or dropped file is the kind the tool takes. */
function matches(f: File, input: string) {
  if (isPdf(input)) return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  if (input === 'sheet' || input === 'sheets') return /\.(xlsx|xlsm|xls|ods|csv)$/i.test(f.name) || /spreadsheet|ms-excel|csv/.test(f.type);
  if (input === 'archive') return /\.(zip|rar|7z)$/i.test(f.name) || /zip|rar|7z/.test(f.type);
  if (input === 'office') return /\.(docx?|pptx?|odt|odp|rtf)$/i.test(f.name);
  if (input === 'files') return true;
  return f.type.startsWith('image/') || /\.(jpe?g|png|webp|avif|gif|bmp|ico|heic|heif)$/i.test(f.name);
}

/** The pick button's words for the kind of file. */
function chooseLabel(t: (k: string) => string, input: string) {
  switch (input) {
    case 'pdf':
      return t('Choose a PDF');
    case 'pdfs':
      return t('Choose PDFs');
    case 'images':
      return t('Choose photos');
    case 'sheet':
      return t('Choose a spreadsheet');
    case 'sheets':
      return t('Choose spreadsheets');
    case 'archive':
      return t('Choose a ZIP, RAR or 7z file');
    case 'files':
      return t('Choose files');
    case 'office':
      return t('Choose a file');
    default:
      return t('Choose a photo');
  }
}

function IconBtn({ label, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className="size-10 rounded-full grid place-items-center hover:bg-fill-strong disabled:opacity-30" {...rest}>
      {children}
    </button>
  );
}
