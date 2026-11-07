'use client';
// Preview of a result (the app's FileViewer for the web): full screen over the page, photos as they are, PDFs in the
// browser's own PDF viewer (real pages, zoom, search). Several files: ‹ › or the arrow keys. Download inside; a link to
// open it in a new tab for browsers that can't show a PDF inside a page (some phones).
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { formatBytes } from '@/lib/format';
import type { OutputFile } from '@/tools/types';

export function FileViewer({ files, urls, start = 0, onClose }: { files: OutputFile[]; urls: string[]; start?: number; onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(start);
  const f = files[i];
  const pdf = /\.pdf$/i.test(f.name);
  const many = files.length > 1;
  const go = (d: number) => setI((n) => (n + d + files.length) % files.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      const rtl = document.documentElement.dir === 'rtl';
      if (many && e.key === 'ArrowRight') go(rtl ? -1 : 1);
      if (many && e.key === 'ArrowLeft') go(rtl ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85" role="dialog" aria-modal="true" aria-label={t('Preview')}>
      <div className="h-16 px-3 sm:px-5 flex items-center gap-2 bg-surface border-b border-line">
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate" dir="auto">
            {f.name}
          </p>
          <p className="text-[12px] text-secondary">
            {many ? `${t('{n} of {total}', { n: i + 1, total: files.length })} · ` : ''}
            {formatBytes(f.blob.size)}
          </p>
        </div>
        <a href={urls[i]} target="_blank" rel="noopener" className="hidden sm:inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full text-sm font-medium hover:bg-fill">
          <ExternalLink size={16} aria-hidden="true" />
          {t('Open in a new tab')}
        </a>
        <a href={urls[i]} download={f.name} className="lime-fill rounded-full min-h-10 px-4 inline-flex items-center gap-2 font-semibold text-sm">
          <Download size={16} aria-hidden="true" />
          {t('Download')}
        </a>
        <button type="button" onClick={onClose} aria-label={t('Close')} autoFocus className="size-10 rounded-full grid place-items-center hover:bg-fill">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
        {pdf ? (
          <div className="size-full flex flex-col gap-2">
            <iframe key={urls[i]} src={urls[i]} title={f.name} className="flex-1 w-full rounded-lg bg-paper" />
            <p className="text-center text-[12px] text-white/70 sm:hidden">
              {t('PDF not showing?')}{' '}
              <a href={urls[i]} target="_blank" rel="noopener" className="underline">
                {t('Open in a new tab')}
              </a>
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a local result, shown as it is
          <img key={urls[i]} src={urls[i]} alt={f.name} className="max-h-full max-w-full object-contain rounded-lg shadow-raised bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] bg-[length:20px_20px]" />
        )}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label={t('Previous')} className="absolute start-2 sm:start-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-surface/90 shadow-raised grid place-items-center hover:bg-surface">
              <ChevronLeft size={24} className="flip-rtl" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t('Next')} className="absolute end-2 sm:end-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-surface/90 shadow-raised grid place-items-center hover:bg-surface">
              <ChevronRight size={24} className="flip-rtl" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
