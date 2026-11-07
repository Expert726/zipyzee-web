'use client';
// Redact PDF's step 2 (the app's custom/redact/RedactStep): every page drawn by pdf.js; drag over anything to hide
// it, click a word to hide just that word, click a box to remove it; "Find and mark" adds every match of the typed
// words, phone numbers or emails (the app's src/tools/redact.ts). Undo / redo. The boxes go to handlers/redactPdf.ts,
// which paints them into the page pictures.
import { useEffect, useRef, useState } from 'react';
import { Loader2, Redo2, Search, Undo2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { openPdf } from '@/lib/pdfjs';
import { pageWords } from '@/lib/pageWords';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import type { PageWords } from '@/tools/compare';
import { addBoxes, boxAt, boxFromDrag, countBoxes, findRedactions, mergePages, parseTerms, wordAt, type Box, type Pt, type RedactPattern } from '@/tools/redact';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

const PAGE_DPI = 110;

export function RedactEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const pages = usePdfThumbs(file, PAGE_DPI);
  const [words, setWords] = useState<PageWords[] | null>(null);
  const [past, setPast] = useState<Box[][][]>([]);
  const [future, setFuture] = useState<Box[][][]>([]);
  const [boxes, setBoxes] = useState<Box[][]>([]);
  const [drag, setDrag] = useState<{ page: number; a: Pt; b: Pt } | null>(null);
  const [terms, setTerms] = useState('');
  const [patterns, setPatterns] = useState<RedactPattern[]>([]);
  const [found, setFound] = useState<string | null>(null);
  const moved = useRef(false);

  // the words and where they are, for clicking a word and Find
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const doc = await openPdf(file);
        const w = await pageWords(doc);
        void doc.destroy();
        if (alive) setWords(w);
      } catch {
        if (alive) setWords([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  const commit = (next: Box[][]) => {
    setPast((p) => [...p, boxes].slice(-50));
    setFuture([]);
    setBoxes(next);
  };
  const setPage = (page: number, list: Box[]) => commit(Array.from({ length: Math.max(boxes.length, page + 1) }, (_, i) => (i === page ? list : boxes[i] ?? [])));

  const at = (e: React.PointerEvent<HTMLDivElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  const onUp = (page: number, p: Pt) => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    const list = boxes[page] ?? [];
    const box = moved.current ? boxFromDrag(d.a, p) : null;
    if (box) return setPage(page, [...list, box]);
    // a click: remove the box under it, or hide the word under it
    const hit = boxAt(list, p);
    if (hit >= 0) return setPage(page, list.filter((_, i) => i !== hit));
    const w = wordAt(words?.[page], p);
    if (w) setPage(page, addBoxes(list, [w]));
  };

  const find = () => {
    if (!words) return;
    const r = findRedactions(words, parseTerms(terms), patterns);
    if (!r.count) return setFound(t('Nothing found. Check the words and try again.'));
    commit(mergePages(boxes, r.boxes));
    const onPages = r.boxes.filter((b) => b.length).length;
    setFound(t('Found {count} on {pages} pages. Tap a box to remove it.', { count: r.count, pages: onPages }));
  };

  const total = countBoxes(boxes);
  const scanned = !!words && words.every((p) => !p.words.length);

  if (pages.error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{pages.error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <div className="flex flex-col items-center gap-6 min-w-0">
        <p className="text-[14px] text-secondary self-start">
          {scanned ? t('This page is a scan: drag over what to hide.') : total ? t('Drag over anything to hide it, or tap a word. Tap a box to remove it.') : t('Drag over anything to hide it, or tap a word.')}
        </p>
        {pages.count == null ? (
          <div className="card min-h-64 w-full grid place-items-center" aria-busy="true">
            <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
          </div>
        ) : (
          Array.from({ length: pages.count }, (_, page) => {
            const list = boxes[page] ?? [];
            const live = drag?.page === page ? boxFromDrag(drag.a, drag.b) : null;
            const size = words?.[page];
            return (
              <div key={page} className="w-full max-w-3xl">
                <p className="text-[12px] text-secondary mb-1">{t('Page {n}', { n: page + 1 })}</p>
                <div
                  className="relative bg-paper shadow-raised cursor-crosshair touch-none select-none"
                  style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '1 / 1.414' }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    moved.current = false;
                    const p = at(e);
                    setDrag({ page, a: p, b: p });
                  }}
                  onPointerMove={(e) => {
                    if (!drag || drag.page !== page) return;
                    const p = at(e);
                    if (Math.abs(p.x - drag.a.x) + Math.abs(p.y - drag.a.y) > 0.01) moved.current = true;
                    setDrag({ ...drag, b: p });
                  }}
                  onPointerUp={(e) => onUp(page, at(e))}
                  onPointerCancel={() => setDrag(null)}
                  role="img"
                  aria-label={t('Page {n}', { n: page + 1 })}
                >
                  {pages.urls[page] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser
                    <img src={pages.urls[page]} alt="" draggable={false} className="absolute inset-0 size-full" />
                  ) : (
                    <Loader2 size={24} className="absolute inset-0 m-auto animate-spin text-secondary" aria-hidden="true" />
                  )}
                  {[...list, ...(live ? [live] : [])].map((b, i) => (
                    <span key={i} className={`absolute ${i < list.length ? 'bg-black' : 'bg-black/50 outline-2 outline-dashed outline-primary'}`} style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} aria-hidden="true" />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <aside className="card p-5 flex flex-col gap-4 lg:sticky lg:top-20">
        <div className="flex items-center gap-1">
          <h2 className="text-[15px] font-semibold flex-1">{t('Find text to hide')}</h2>
          <button type="button" disabled={!past.length} onClick={() => { setFuture((f) => [boxes, ...f]); setBoxes(past[past.length - 1]); setPast((p) => p.slice(0, -1)); }} aria-label={t('Undo')} title={t('Undo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button type="button" disabled={!future.length} onClick={() => { setPast((p) => [...p, boxes]); setBoxes(future[0]); setFuture((f) => f.slice(1)); }} aria-label={t('Redo')} title={t('Redo')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
            <Redo2 size={18} aria-hidden="true" />
          </button>
        </div>
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
          <input value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={t('CNIC, account number')} dir="auto" className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-normal" aria-label={t('Find text to hide')} />
          <span className="text-[12px] font-normal text-secondary">{t('Separate words with commas')}</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['phones', t('Phone numbers')],
              ['emails', t('Emails')],
            ] as [RedactPattern, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={patterns.includes(v)} onClick={() => setPatterns((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))} className={`px-4 min-h-9 rounded-full text-sm font-medium border ${patterns.includes(v) ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong'}`}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="secondary" disabled={!words || (!terms.trim() && !patterns.length)} onClick={find}>
          <Search size={18} aria-hidden="true" className="inline me-2" />
          {t('Find and mark')}
        </Button>
        {found && (
          <p className="text-[13px] text-secondary" role="status">
            {found}
          </p>
        )}
        <Button arrow disabled={!total} onClick={() => onStart({ boxes })} className="w-full">
          {total === 1 ? t('Redact 1 area') : total ? t('Redact {count} areas', { count: total }) : t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
