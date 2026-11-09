'use client';
// Smart scan on the web (the app: ML Kit's scanner, then custom/scan/ScanReviewStep, design/ScanReview.dc.html):
// Take a photo (the phone's camera) or choose photos; each page's corners are found (src/lib/docScan.ts) and can be
// dragged; Corners / Result view; filters Original, Clean (default), Grayscale, B and W for all pages; per page
// Rotate, Find corners again, Whole photo, Delete, move earlier / later; Save as one PDF or as images.
import { useEffect, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Crop, ImagePlus, Loader2, Maximize, RotateCcw, RotateCw, ScanLine, Trash2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { findCorners, loadScanPhoto, renderScanPage, type ScanPageIn } from '@/lib/docScan';
import { rotateRight, SCAN_FILTERS, type Rotation, type ScanFilter } from '@/tools/scan';
import { FULL_QUAD } from '@/tools/scanQuad';
import { ToolError } from '@/tools/types';
import { Button } from '../../../ui/Button';
import { Choice } from '../../../custom/makedoc/parts';
import type { CustomSetupProps } from '../index';
import { QuadEditor } from './QuadEditor';

type Page = ScanPageIn & { id: number };
let nextId = 1;

/** Photo pickers: the phone camera (capture) and the file chooser. */
export function PhotoInputs({ onFiles, multiple = true, compact = false }: { onFiles: (f: File[]) => void; multiple?: boolean; compact?: boolean }) {
  const t = useT();
  const camera = useRef<HTMLInputElement>(null);
  const choose = useRef<HTMLInputElement>(null);
  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = [...(e.target.files ?? [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    e.target.value = '';
    if (list.length) onFiles(list);
  };
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={take} />
      <input ref={choose} type="file" accept="image/*,.heic,.heif" multiple={multiple} className="sr-only" tabIndex={-1} onChange={take} />
      <Button variant={compact ? 'secondary' : 'primary'} onClick={() => camera.current?.click()}>
        <Camera size={18} aria-hidden="true" className="inline me-2" />
        {t('Take a photo')}
      </Button>
      <Button variant="secondary" onClick={() => choose.current?.click()}>
        <ImagePlus size={18} aria-hidden="true" className="inline me-2" />
        {multiple ? t('Choose photos') : t('Choose a photo')}
      </Button>
    </div>
  );
}

export function ScanEditor({ tool, files, onStart }: CustomSetupProps) {
  const t = useT();
  const [pages, setPages] = useState<Page[]>([]);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<ScanFilter>('clean');
  const [output, setOutput] = useState<'pdf' | 'images'>('pdf');
  const [view, setView] = useState<'corners' | 'result'>('corners');
  const [loading, setLoading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const imported = useRef(new Set<File>());

  const add = async (list: File[]) => {
    setError(null);
    setLoading((n) => n + list.length);
    for (const f of list) {
      try {
        const p = await loadScanPhoto(f);
        setPages((ps) => {
          setIndex(ps.length);
          return [...ps, { ...p, id: nextId++ }];
        });
      } catch (e) {
        setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
      setLoading((n) => n - 1);
    }
  };

  // photos handed over ("Continue to…") or dropped on the page
  useEffect(() => {
    const fresh = files.filter((f) => !imported.current.has(f));
    if (!fresh.length) return;
    fresh.forEach((f) => imported.current.add(f));
    void Promise.resolve().then(() => add(fresh));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only new files
  }, [files]);

  const page = pages[Math.min(index, pages.length - 1)];
  const update = (patch: Partial<ScanPageIn>) => setPages((ps) => ps.map((p) => (p.id === page?.id ? { ...p, ...patch } : p)));

  // the finished look of the current page (Result view), and small finished pages for the strip
  useEffect(() => {
    if (!page || view !== 'result') return;
    let alive = true;
    const id = setTimeout(() => {
      const c = renderScanPage(page, filter, 1400);
      if (alive) setResult(c.toDataURL('image/jpeg', 0.85));
      c.width = c.height = 0;
    }, 60);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [page, filter, view]);
  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      const next: Record<number, string> = {};
      for (const p of pages) {
        const c = renderScanPage(p, filter, 220);
        next[p.id] = c.toDataURL('image/jpeg', 0.7);
        c.width = c.height = 0;
      }
      if (alive) setThumbs(next);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [pages, filter]);

  if (!pages.length) {
    return (
      <div className="card p-8 sm:p-12 flex flex-col items-center text-center gap-4">
        <span className="size-16 rounded-full bg-category-tint text-category grid place-items-center">
          <ScanLine size={30} aria-hidden="true" />
        </span>
        <p className="text-[17px] font-semibold">{t('Photograph your pages')}</p>
        <p className="text-[14px] text-secondary max-w-md">{t('Lay the paper on a darker surface in good light. The edges are found for you, and you can adjust them.')}</p>
        {loading > 0 ? <Loader2 size={26} className="animate-spin text-primary" aria-label={t('Opening the photo…')} /> : <PhotoInputs onFiles={(f) => void add(f)} />}
        {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
      </div>
    );
  }

  const move = (d: -1 | 1) => {
    const i = pages.indexOf(page);
    const j = i + d;
    if (j < 0 || j >= pages.length) return;
    const next = [...pages];
    [next[i], next[j]] = [next[j], next[i]];
    setPages(next);
    setIndex(j);
  };
  const remove = () => {
    const i = pages.indexOf(page);
    setPages((ps) => ps.filter((p) => p.id !== page.id));
    setIndex(Math.max(0, i - 1));
  };
  const pageNo = pages.indexOf(page) + 1;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-3 sm:p-5 flex flex-col items-center gap-4">
        {/* pages */}
        <div className="w-full flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label={t('Pages')}>
          {pages.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === page.id} onClick={() => setIndex(i)} className={`relative shrink-0 w-16 h-20 rounded-md overflow-hidden bg-fill border ${p.id === page.id ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a scanned page */}
              {thumbs[p.id] ? <img src={thumbs[p.id]} alt="" className="size-full object-contain bg-white" /> : <Loader2 size={16} className="m-auto animate-spin text-secondary" aria-hidden="true" />}
              <span className="absolute bottom-0.5 end-0.5 min-w-5 h-5 px-1 rounded-full bg-black/60 text-white text-[11px] font-semibold grid place-items-center">{i + 1}</span>
            </button>
          ))}
          {loading > 0 && (
            <span className="shrink-0 w-16 h-20 rounded-md bg-fill grid place-items-center" aria-busy="true">
              <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            </span>
          )}
        </div>

        <Choice value={view} options={[['corners', t('Corners')], ['result', t('Result')]]} onChange={setView} />
        {view === 'corners' ? (
          <QuadEditor photo={page.photo} quad={page.quad} onChange={(quad) => update({ quad })} />
        ) : result ? (
          // eslint-disable-next-line @next/next/no-img-element -- the finished page
          <img src={result} alt={t('Page {n}', { n: pageNo })} className="block max-w-full max-h-[64vh] shadow-raised bg-white" />
        ) : (
          <Loader2 size={26} className="animate-spin text-primary my-16" aria-hidden="true" />
        )}
        <p className="text-[12px] text-secondary text-center">{view === 'corners' ? t('Drag the corners onto the corners of the paper.') : t('This is how page {n} will look.', { n: pageNo })}</p>
      </section>

      <aside className="card p-5 flex flex-col gap-5 lg:sticky lg:top-20">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Filter')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {SCAN_FILTERS.map((f) => (
              <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)} className={`px-3.5 min-h-9 rounded-full text-sm font-medium border ${filter === f.value ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
                {t(f.label)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Page {n}', { n: pageNo })}</legend>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                [t('Rotate left'), RotateCcw, () => update({ rotation: rotateRight(rotateRight(rotateRight(page.rotation))) as Rotation })],
                [t('Rotate right'), RotateCw, () => update({ rotation: rotateRight(page.rotation) })],
                [t('Find edges'), Crop, () => update({ quad: findCorners(page.photo) })],
                [t('Whole photo'), Maximize, () => update({ quad: FULL_QUAD })],
                [t('Move left'), ChevronLeft, () => move(-1)],
                [t('Move right'), ChevronRight, () => move(1)],
                [t('Delete'), Trash2, remove],
              ] as const
            ).map(([label, Icon, run]) => (
              <button key={label} type="button" onClick={run} title={label} className="min-h-14 rounded-tile border border-line-strong flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium hover:bg-fill px-1 text-center leading-tight">
                <Icon size={18} aria-hidden="true" className="flip-rtl" />
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">{t('Add page')}</p>
          <PhotoInputs onFiles={(f) => void add(f)} compact />
        </div>

        <Choice label={t('Save as')} value={output} options={[['pdf', 'PDF'], ['images', t('Images')]]} onChange={setOutput} />
        {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
        <Button arrow disabled={loading > 0} onClick={() => onStart({ pages: pages.map(({ photo, quad, rotation }) => ({ photo, quad, rotation })), filter, output })} className="w-full">
          {output === 'pdf' ? t(tool.verb) : t('Save images')}
        </Button>
      </aside>
    </div>
  );
}
