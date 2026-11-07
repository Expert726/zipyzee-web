'use client';
// Remove watermark's step 2 (the app's custom/RemoveWatermarkStep): what was found on the PDF, each kind with a switch
// (watermark layer, see-through text or logo, the same image on every page, watermark notes), and the page Before |
// After, the After being the real result (the PDF rebuilt without the switched-on parts and drawn by pdf.js), a moment
// after the switches stop changing. Finding and removing: src/tools/watermark/ (the app's).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { useT } from '@/i18n/client';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { cleanAll, defaultKinds, FOUND_KINDS, scanWatermarks, type FoundKind } from '@/tools/watermark/pdf';
import type { Translate } from '@/i18n';
import { BeforeAfter } from '../BeforeAfter';
import { Button } from '../../ui/Button';
import { Switch } from '../../custom/makedoc/parts';
import type { CustomSetupProps } from './index';

const DEBOUNCE_MS = 300;
const PREVIEW_DPI = 90;

const kindText = (k: FoundKind, t: Translate) =>
  ({ layer: t('Watermark layer'), overlay: t('See-through text or logo over the page'), stamp: t('The same image on every page'), notes: t('Watermark notes') })[k];
const whereText = (k: FoundKind, n: number, t: Translate) =>
  k === 'notes' ? (n === 1 ? t('1 note') : t('{count} notes', { count: n })) : n === 1 ? t('On 1 page') : t('On {count} pages', { count: n });

type Scanned = { bytes: Uint8Array; found: Record<FoundKind, number>; count: number };

async function pagePicture(src: File | { name: string; bytes: Uint8Array }, page: number) {
  const doc = await openPdf(src);
  try {
    const c = await renderPage(doc, page, PREVIEW_DPI);
    const out = { url: URL.createObjectURL(await canvasBlob(c, 'image/jpeg', 0.85)), aspect: c.width / c.height };
    c.width = c.height = 0;
    return out;
  } finally {
    void doc.destroy();
  }
}

export function RemoveWatermarkEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [scanned, setScanned] = useState<Scanned | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kinds, setKinds] = useState<FoundKind[] | null>(null);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<{ before: string; after: string; aspect: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const urls = useRef<string[]>([]);

  // look for watermarks once
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes, { updateMetadata: false });
        const scan = scanWatermarks(doc);
        if (!live) return;
        setScanned({ bytes, found: scan.found, count: doc.getPageCount() });
        setKinds((k) => k ?? defaultKinds(scan.found));
      } catch (e) {
        if (live) setError(/encrypt/i.test(String(e)) ? t('{name} is password protected. Unlock it first.', { name: file.name }) : t('{name} could not be opened. It may be damaged.', { name: file.name }));
      }
    })();
    return () => {
      live = false;
    };
  }, [file, t]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const chosen = useMemo(() => (kinds ?? []).filter((k) => (scanned?.found[k] ?? 0) > 0), [kinds, scanned]);
  const key = chosen.join(',');

  // the page before and after, a moment after the switches stop changing
  useEffect(() => {
    if (!scanned) return;
    let live = true;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const doc = await PDFDocument.load(scanned.bytes, { updateMetadata: false });
        cleanAll(doc, scanWatermarks(doc), chosen);
        const cleaned = await doc.save();
        const [before, after] = await Promise.all([pagePicture({ name: file.name, bytes: scanned.bytes }, page), pagePicture({ name: file.name, bytes: cleaned }, page)]);
        urls.current.push(before.url, after.url);
        if (live) setPreview({ before: before.url, after: after.url, aspect: before.aspect });
      } catch {
        // the preview is a help; the button still works
      } finally {
        if (live) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [scanned, file.name, key, chosen, page]);

  if (error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a PDF')}
        </Button>
      </div>
    );
  }

  const found = scanned ? FOUND_KINDS.filter((k) => scanned.found[k] > 0) : [];
  const nothing = !!scanned && !found.length;
  const count = scanned?.count ?? 0;
  const blocked = !scanned ? t('Looking for watermarks') : nothing ? t('Nothing to remove') : chosen.length ? null : t('Turn on what to remove');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <section className="card p-4 sm:p-6 flex flex-col items-center gap-3" aria-label={t('Before and after preview')}>
        {preview ? (
          <BeforeAfter before={preview.before} after={preview.after} aspect={preview.aspect} busy={busy} />
        ) : (
          <div className="w-full max-w-md aspect-[1/1.414] rounded-lg bg-fill grid place-items-center" aria-busy="true">
            <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
          </div>
        )}
        {count > 1 && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label={t('Previous page')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <ChevronLeft size={20} className="flip-rtl" aria-hidden="true" />
            </button>
            <span className="text-[14px] font-medium tabular-nums">{t('Page {n} of {count}', { n: page + 1, count })}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(count - 1, p + 1))} disabled={page >= count - 1} aria-label={t('Next page')} className="size-10 rounded-full grid place-items-center hover:bg-fill disabled:opacity-30">
              <ChevronRight size={20} className="flip-rtl" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>

      <section className="card p-5 flex flex-col gap-5" aria-label={t('Found on this PDF')}>
        <h2 className="text-[15px] font-semibold">{t('Found on this PDF')}</h2>
        {!scanned ? (
          <p className="flex items-center gap-2 text-[14px] text-secondary" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            {t('Looking for watermarks')}
          </p>
        ) : nothing ? (
          <p className="text-[14px] text-muted">{t('No separate watermark found. If it\'s part of a scanned page, it can\'t be removed.')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {found.map((k) => (
              <Switch
                key={k}
                label={kindText(k, t)}
                sub={whereText(k, scanned.found[k], t)}
                value={chosen.includes(k)}
                onChange={(on) => setKinds((prev) => (on ? [...(prev ?? []), k] : (prev ?? []).filter((x) => x !== k)))}
              />
            ))}
          </div>
        )}
        <p className="flex gap-2 items-start rounded-tile bg-info-soft text-info-ink p-3 text-[13px]">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t('Only remove watermarks from documents you own or have the right to change.')}
        </p>
        {blocked && <p className="text-[13px] text-secondary">{blocked}</p>}
        <Button arrow disabled={!!blocked} onClick={() => onStart({ kinds: chosen })} className="w-full">
          {t(tool.verb)}
        </Button>
      </section>
    </div>
  );
}
