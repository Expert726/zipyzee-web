'use client';
// Compare PDF's step 4 (the app's custom/compare/CompareResultStep): Version 1 and Version 2 side by side, removed
// words in red and added words in green, the Removed / Added legend, Show (All changes / Added / Removed), page by
// page. "Save report" builds the app's report (each page pair side by side with the highlights) and then shows the
// usual result screen for it.
import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileDown, Loader2, RotateCcw } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import { useT } from '@/i18n/client';
import { fileStem } from '@/lib/format';
import { loadPdf, savePdf } from '@/lib/pdf';
import { usePdfThumbs } from '@/lib/usePdfThumbs';
import { pagesLabel } from '@/tools/pdfOps';
import type { Box } from '@/tools/compare';
import type { Tool, ToolResult } from '@/tools/types';
import { Button } from '../../ui/Button';
import { Choice } from '../../custom/makedoc/parts';
import { Result } from '../Result';

type Show = 'all' | 'added' | 'removed';
const PAGE_DPI = 90;

/** "contract-v2.pdf" -> "contract" (the version suffix dropped) for "contract-changes-report.pdf". The app's. */
export const reportStem = (name: string) => fileStem(name).replace(/[-_ ]?v(ersion)?[-_ ]?\d+$/i, '') || fileStem(name);

export function CompareResult({ tool, files, result, onReset }: { tool: Tool; files: File[]; result: ToolResult; onReset: () => void }) {
  const t = useT();
  const compare = result.compare!;
  const [page, setPage] = useState(0);
  const [show, setShow] = useState<Show>('all');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ result: ToolResult; urls: string[] } | null>(null);
  const v1 = usePdfThumbs(files[0], PAGE_DPI);
  const v2 = usePdfThumbs(files[1], PAGE_DPI);

  if (report) return <Result tool={tool} result={report.result} urls={report.urls} onBack={() => setReport(null)} onReset={onReset} />;

  const saveReport = async () => {
    setSaving(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([loadPdf(files[0]), loadPdf(files[1])]);
      const doc = await PDFDocument.create();
      const gap = 24;
      for (let i = 0; i < compare.pages.length; i++) {
        const pa = i < a.getPageCount() ? await doc.embedPage(a.getPage(i)) : null;
        const pb = i < b.getPageCount() ? await doc.embedPage(b.getPage(i)) : null;
        const wa = pa?.width ?? pb!.width;
        const ha = pa?.height ?? pb!.height;
        const wb = pb?.width ?? wa;
        const hb = pb?.height ?? ha;
        const out = doc.addPage([wa + gap + wb, Math.max(ha, hb)]);
        const H = out.getHeight();
        if (pa) out.drawPage(pa, { x: 0, y: H - ha });
        if (pb) out.drawPage(pb, { x: wa + gap, y: H - hb });
        const mark = (boxes: Box[], x0: number, w: number, h: number, color: ReturnType<typeof rgb>) =>
          boxes.forEach((bx) => out.drawRectangle({ x: x0 + bx.x * w, y: H - (bx.y + bx.h) * h, width: bx.w * w, height: bx.h * h, color, opacity: 0.4 }));
        mark(compare.pages[i].removed, 0, wa, ha, rgb(0.97, 0.44, 0.44));
        mark(compare.pages[i].added, wa + gap, wb, hb, rgb(0.2, 0.83, 0.6));
      }
      const saved = await savePdf(doc, `${reportStem(files[1].name)}-changes-report.pdf`);
      setReport({
        result: { title: t('{count} changes found', { count: compare.total }), subtitle: t('Report with highlights, {pages}', { pages: pagesLabel(doc.getPageCount()) }), files: [saved] },
        urls: [URL.createObjectURL(saved.blob)],
      });
    } catch {
      setError(t('Could not save the report. Try again.'));
    }
    setSaving(false);
  };

  const count = compare.pages.length;
  const diffs = compare.pages[page];
  const none = compare.total === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[22px] font-semibold tracking-tight">{result.title}</h2>
          <p className="text-[13px] text-secondary">{none ? t('The text of these two versions is the same.') : t('{count} changes in total', { count: compare.total })}</p>
        </div>
        <Button variant="secondary" onClick={onReset}>
          <RotateCcw size={18} aria-hidden="true" className="inline me-2" />
          {t('Start over')}
        </Button>
        <Button onClick={() => void saveReport()} disabled={saving} className="!min-h-12">
          {saving ? <Loader2 size={18} className="inline me-2 animate-spin" aria-hidden="true" /> : <FileDown size={18} aria-hidden="true" className="inline me-2" />}
          {t('Save report')}
        </Button>
      </div>
      {error && (
        <p className="text-[14px] text-error" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Choice label={t('Show')} value={show} options={[['all', t('All changes')], ['added', t('Added')], ['removed', t('Removed')]]} onChange={setShow} />
        <span className="flex items-center gap-4 text-[13px] text-secondary ms-auto" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: '#F8717166', outline: '1px solid #F87171' }} />
            {t('Removed')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: '#34D39966', outline: '1px solid #34D399' }} />
            {t('Added')}
          </span>
        </span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label={t('Previous page')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
          <ChevronLeft size={20} className="flip-rtl" aria-hidden="true" />
        </button>
        <span className="text-[14px] font-medium tabular-nums">
          {t('Page {n} of {count}', { n: page + 1, count })} · {diffs.changes === 1 ? t('1 change on this page') : t('{count} changes on this page', { count: diffs.changes })}
        </span>
        <button type="button" onClick={() => setPage((p) => Math.min(count - 1, p + 1))} disabled={page >= count - 1} aria-label={t('Next page')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
          <ChevronRight size={20} className="flip-rtl" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Side n={page + 1} label={t('Version 1')} name={files[0].name} url={v1.urls[page]} exists={page < compare.pages1} boxes={show === 'added' ? [] : diffs.removed} color="#F87171" />
        <Side n={page + 1} label={t('Version 2')} name={files[1].name} url={v2.urls[page]} exists={page < compare.pages2} boxes={show === 'removed' ? [] : diffs.added} color="#34D399" />
      </div>
    </div>
  );
}

function Side({ n, label, name, url, exists, boxes, color }: { n: number; label: string; name: string; url?: string; exists: boolean; boxes: Box[]; color: string }) {
  const t = useT();
  return (
    <figure className="card p-3 flex flex-col gap-2" aria-label={t('{label}, page {n}, {count} highlighted words', { label, n, count: boxes.length })}>
      <figcaption className="text-[13px] font-semibold flex gap-2">
        <span>{label}</span>
        <span className="text-secondary font-normal truncate" dir="auto">
          {name}
        </span>
      </figcaption>
      {!exists ? (
        <div className="aspect-[1/1.414] rounded-lg bg-fill grid place-items-center text-[14px] text-secondary">{t('No page {n} in this version', { n })}</div>
      ) : (
        <div className="relative bg-paper rounded-sm shadow-raised">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser
            <img src={url} alt="" className="block w-full" />
          ) : (
            <div className="aspect-[1/1.414] grid place-items-center">
              <Loader2 size={24} className="animate-spin text-secondary" aria-hidden="true" />
            </div>
          )}
          {url &&
            boxes.map((b, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="absolute rounded-[2px] mix-blend-multiply"
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%`, background: `${color}66`, outline: `1px solid ${color}` }}
              />
            ))}
        </div>
      )}
    </figure>
  );
}
